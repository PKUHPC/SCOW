/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, Modal, Upload, UploadFile } from "antd";
import pLimit from "p-limit";
import { join } from "path";
import { useRef, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { urlToUpload } from "src/pageComponents/filemanager/api";
import { publicConfig } from "src/utils/config";
import { calculateBlobSHA256 } from "src/utils/file";
import { convertToBytes } from "src/utils/format";
interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: string;
  path: string;
  scowdEnabled: boolean;
}

interface UploadProgressEvent {
  percent: number;
}

const p = prefix("pageComp.fileManagerComp.uploadModal.");

type OnProgressCallback = undefined | ((progressEvent: UploadProgressEvent) => void);

export const UploadModal: React.FC<Props> = ({ open, onClose, path, reload, cluster, scowdEnabled }) => {
  const { message, modal } = App.useApp();
  const [ uploadFileList, setUploadFileList ] = useState<UploadFile[]>([]);
  const uploadControllers = useRef(new Map<string, AbortController>());

  const t = useI18nTranslateToString();

  const onModalClose = () => {
    setUploadFileList([]);
    for (const controller of Array.from(uploadControllers.current.values())) {
      controller.abort();
    }

    onClose();
  };

  const handleRemove = (file: UploadFile) => {
    const controller = uploadControllers.current.get(file.uid);
    if (controller) {
      controller.abort();
      uploadControllers.current.delete(file.uid);
    }

    return true;
  };

  const startMultipartUpload = async (file: File, onProgress: OnProgressCallback) => {
    const { tempFileDir, chunkSizeByte, filesInfo } = await api.initMultipartUpload({
      body: { cluster, path, name: file.name },
    });

    const uploadedChunks = filesInfo.sort((a, b) => {
      const reg = /_(\d+)/;
      const matchA = reg.exec(a.name);
      const matchB = reg.exec(b.name);

      if (matchA && matchB) {
        return parseInt(matchA[1]) - parseInt(matchB[1]);
      } else {
        return 0;
      }
    }).map((item) => item.name);

    const totalCount = Math.ceil(file.size / chunkSizeByte);
    const concurrentChunks = 3;
    let uploadedCount = uploadedChunks.length;

    const uploadFile = uploadFileList.find((uploadFile) => uploadFile.name === file.name);
    if (!uploadFile) {
      message.error(t(p("uploadFileListNotExist"), [file.name]));
      return;
    }

    const updateProgress = () => {
      uploadedCount++;
      onProgress?.({ percent: Number(((uploadedCount / totalCount) * 100).toFixed(2)) });
    };

    const controller = new AbortController();
    uploadControllers.current.set(uploadFile.uid, controller);

    const limit = pLimit(concurrentChunks);
    const uploadChunk = async (start: number): Promise<void> => {
      if (controller.signal.aborted) {
        return;
      }

      const chunk = file.slice(start * chunkSizeByte, (start + 1) * chunkSizeByte);
      const hash = await calculateBlobSHA256(chunk);
      const fileName = `${hash}_${start + 1}.scowuploadtemp`;

      if (uploadedChunks.includes(fileName)) {
        return;
      }

      const formData = new FormData();
      formData.append("file", chunk);

      const response = await fetch(urlToUpload(cluster, join(tempFileDir, fileName)), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      updateProgress();
    };

    try {
      const uploadPromises: Promise<void>[] = [];
      for (let i = 0; i < totalCount; i++) {
        if (controller.signal.aborted) {
          break;
        }
        uploadPromises.push(limit(() => uploadChunk(i)));
      }

      await Promise.all(uploadPromises);

      await api.mergeFileChunks({ body: { cluster, path, name: file.name, sizeByte: file.size } })
        .httpError(520, (err) => {
          message.error(t(p("mergeFileChunksErrorText"), [file.name]));
          throw err;
        });
    } catch (err) {
      message.error(t(p("multipartUploadError"), [err.message]));
      throw err;
    } finally {
      uploadControllers.current.delete(uploadFile.uid);
    }
  };


  return (
    <Modal
      open={open}
      title={t(p("title"))}
      onCancel={onModalClose}
      destroyOnClose={true}
      maskClosable={false}
      footer={[
        <Button key="close" onClick={onModalClose}>
          {t("button.closeButton")}
        </Button>,
      ]}
    >
      <p>
        {t(p("uploadRemark1"))}<strong>{path}</strong>{t(p("uploadRemark2"))}
      </p>
      <p>
        {t(p("uploadRemark3"))}<strong>{publicConfig.CLIENT_MAX_BODY_SIZE}</strong>{t(p("uploadRemark4"))}
      </p>
      <Upload.Dragger
        name="file"
        multiple
        {...(scowdEnabled ? {
          customRequest: ({ file, onSuccess, onError, onProgress }) => {
            startMultipartUpload(file as File, onProgress).then(onSuccess).catch(onError);
          },
        } : {
          action: async (file) => urlToUpload(cluster, join(path, file.name)),
        })}
        withCredentials
        showUploadList={{
          removeIcon: (file) => {
            return (
              file.status === "uploading"
                ? (
                  <DeleteOutlined
                    onClick={scowdEnabled ? () => handleRemove(file) : undefined}
                    title={t(p("cancelUpload"))}
                  />
                )
                : <DeleteOutlined title={t(p("deleteUploadRecords"))} />
            );
          },
        }}
        onChange={({ file, fileList }) => {

          const updatedFileList = [...fileList.filter((f) => f.status)];
          setUploadFileList(updatedFileList);

          if (file.status === "done") {
            message.success(`${file.name}${t(p("successMessage"))}`);
            reload();
          } else if (file.status === "error") {
            message.error(`${file.name}${t(p("errorMessage"))}`);
          }
        }}
        beforeUpload={(file) => {
          const fileMaxSize = convertToBytes(publicConfig.CLIENT_MAX_BODY_SIZE);

          if (file.size > fileMaxSize) {
            message.error(t(p("maxSizeErrorMessage"), [file.name, publicConfig.CLIENT_MAX_BODY_SIZE]));
            return Upload.LIST_IGNORE;
          }

          return new Promise((resolve, reject) => {

            api.fileExist({ query:{ cluster: cluster, path: join(path, file.name) } }).then(({ result }) => {
              if (result) {
                modal.confirm({
                  title: t(p("existedModalTitle")),
                  content: t(p("existedModalContent"), [file.name]),
                  okText: t(p("existedModalOk")),
                  onOk: async () => {
                    const fileType = await api.getFileType({ query:{ cluster: cluster, path: join(path, file.name) } });
                    const deleteOperation = fileType.type === "dir" ? api.deleteDir : api.deleteFile;
                    await deleteOperation({ query: { cluster: cluster, path: join(path, file.name) } })
                      .then(() => resolve(file));
                  },
                  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                  onCancel: () => { reject(file); },
                });
              } else {
                resolve(file);
              }

            });


          });
        }}
        fileList={uploadFileList}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t(p("dragText"))}</p>
        <p className="ant-upload-hint">
          {t(p("hintText"))}
        </p>
      </Upload.Dragger>
    </Modal>
  );
};

