import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { useUploadSpeedTracker } from "@scow/lib-web/build/utils/fileUpload/uploadSpeedHook";
import { isDirectoryEntry, PercentAndSpeedContainer } from "@scow/lib-web/build/utils/fileUpload/uploadUtils";
import { App, Button, Modal, Upload, UploadFile } from "antd";
import pLimit from "p-limit";
import { join } from "path";
import { useEffect, useRef, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { urlToUpload } from "src/pageComponents/filemanager/api";
import { publicConfig } from "src/utils/config";
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
const pCommon = prefix("common.");

type OnProgressCallback = undefined | ((progressEvent: UploadProgressEvent) => void);


export const UploadModal: React.FC<Props> = ({ open, onClose, path, reload, cluster, scowdEnabled }) => {

  const { message, modal } = App.useApp();
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const uploadFileListRef = useRef<UploadFile[]>([]);
  const uploadControllers = useRef(new Map<string, AbortController>());
  const limit = useRef(pLimit(2));

  const t = useI18nTranslateToString();
  // 使用上传文件的速度追踪器，速度更新时间 1000 ms
  const speedTracker = useUploadSpeedTracker(1000);

  // 判断当前拖拽是否有文件夹
  const hasFolderInDropRef = useRef(false);

  useEffect(() => {
    uploadFileListRef.current = uploadFileList;
  }, [uploadFileList]);

  useEffect(() => {
    return () => {
      setUploadFileList([]);
    };
  }, [open]);

  const onModalClose = () => {
    limit.current.clearQueue();
    for (const controller of Array.from(uploadControllers.current.values())) {
      controller.abort();
    }

    uploadControllers.current.clear();
    speedTracker.cleanupAll();
    onClose();
  };

  const handleRemove = (file: UploadFile) => {
    const controller = uploadControllers.current.get(file.uid);
    if (controller) {
      controller.abort();
      uploadControllers.current.delete(file.uid);
      speedTracker.cleanupFile(file.uid);
    }

    return true;
  };

  const startMultipartUpload = async (file: File, onProgress: OnProgressCallback) => {
    let initData = await api.initMultipartUpload({
      body: { cluster, path, name: file.name, fileSizeByte: file.size, modificationTime: file.lastModified },
    }).httpError(429, () => { message.error(t(pCommon("noSpaceError"))); });

    if (initData.fileSizeByte !== file.size || initData.modificationTime !== file.lastModified) {
      await new Promise<void>((resolve, reject) => {
        modal.confirm({
          title: t(p("resumeUploadTitle")),
          content: t(p("resumeUploadContent")),
          okText: t(p("resumeUploadOk")),
          cancelText: t(p("resumeUploadCancel")),
          onOk: async () => {
            try {
              await api.deleteFile({ query: { cluster, path: join(path, file.name + ".uploading") } });
            } catch (e) {
              console.error("Failed to delete .uploading file", e);
            }

            initData = await api.initMultipartUpload({
              body: { cluster, path, name: file.name, fileSizeByte: file.size, modificationTime: file.lastModified },
            }).httpError(429, () => { message.error(t(pCommon("noSpaceError"))); });
            resolve();
          },
          onCancel: () => {
            reject(new Error("User cancelled upload"));
          },
        });
      });
    }

    const { chunkSizeByte, uploadedIndices } = initData;

    const uploadedChunkIndices = new Set(uploadedIndices);

    const totalCount = Math.ceil(file.size / chunkSizeByte);

    // 计算已上传字节数
    let loadedBytes = 0;
    uploadedChunkIndices.forEach((index) => {
      if (index === totalCount) {
        loadedBytes += (file.size - (totalCount - 1) * chunkSizeByte);
      } else {
        loadedBytes += chunkSizeByte;
      }
    });

    const uploadFile = uploadFileListRef.current.find((uploadFile) => uploadFile.name === file.name);
    if (!uploadFile) {
      message.error(t(p("uploadFileListNotExist"), [file.name]));
      return;
    }

    speedTracker.initFileSpeed(uploadFile.uid, loadedBytes);

    const updateProgress = (chunkSize: number) => {
      loadedBytes += chunkSize;
      const percentage = Number(((loadedBytes / file.size) * 100).toFixed(2));

      // 更新速度
      speedTracker.updateFileBytes(uploadFile.uid, loadedBytes);

      // 手动更新 fileList 中的percent
      setUploadFileList((prevList) => {
        return prevList.map((uploadFile) => {
          return uploadFile.name === file.name
            ? {
              ...uploadFile,
              percent: percentage,
              status: "uploading" as const
            }
            : uploadFile;
        });
      });

      onProgress?.({ percent: percentage });
    };

    const controller = new AbortController();
    uploadControllers.current.set(uploadFile.uid, controller);

    const uploadChunk = async (start: number): Promise<void> => {
      if (controller.signal.aborted) {
        return;
      }

      if (uploadedChunkIndices.has(start)) {
        // 如果文件块已经上传，直接跳过
        return;
      }

      const chunk = file.slice(start * chunkSizeByte, (start + 1) * chunkSizeByte);

      const formData = new FormData();
      formData.append("file", chunk);

      const response = await fetch(urlToUpload(cluster, join(path, file.name), true, undefined, start), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      updateProgress(chunk.size);

    };

    try {
      const chunkLimit = pLimit(2);
      const tasks: Promise<void>[] = [];

      for (let i = 0; i < totalCount; i++) {
        if (controller.signal.aborted) {
          break;
        }

        // 如果分片已经上传过，跳过
        if (uploadedChunkIndices.has(i)) {
          continue;
        }

        tasks.push(chunkLimit(() => uploadChunk(i)));
      }

      await Promise.all(tasks);

      if (!controller.signal.aborted) {
        await api.completeMultipartUpload({ body: { cluster, path, name: file.name } })
          .httpError(429, () => { message.error(t(pCommon("noSpaceError"))); })
          .httpError(520, (err) => {
            message.error(t(p("completeUploadErrorText"), [file.name, err?.error]));
          });
      }

    } catch (err) {
      controller.abort();
      message.error(t(p("multipartUploadError"), [err.message]));
      throw err;
    } finally {
      uploadControllers.current.delete(uploadFile.uid);
      speedTracker.cleanupFile(uploadFile.uid);
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
        {t(p("uploadRemark1"))}<span>{path}</span>{t(p("uploadRemark2"))}
      </p>
      {!scowdEnabled && (
        <p>
          {t(p("uploadRemark3"))}<span>{publicConfig.CLIENT_MAX_BODY_SIZE}</span>{t(p("uploadRemark4"))}
        </p>
      )}
      <div
        onDropCapture={(event) => {
          const droppedItems = Array.from(event.dataTransfer?.items ?? []);
          const hasDirectory = droppedItems.some((item) => isDirectoryEntry(item));
          // 捕获阶段先于 Upload 内部处理，确保 beforeUpload 读到的是本次 drop 的值
          hasFolderInDropRef.current = hasDirectory;
          if (hasDirectory) {
            // 阻止事件到达 Upload.Dragger，避免其尝试处理含文件夹的 drop
            event.preventDefault();
            event.stopPropagation();
            message.error(t(p("isNotFile")));
          }
        }}
        onClickCapture={() => {
          // 点击打开文件选择框时重置，避免上次 folder drop 污染点击上传
          hasFolderInDropRef.current = false;
        }}
      >
        <Upload.Dragger
          name="file"
          multiple
          {...(scowdEnabled ? {
            customRequest: ({ file, onSuccess, onError, onProgress }) => {
              limit.current(() => startMultipartUpload(file as File, onProgress).then(onSuccess).catch(onError));
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
            // 本次拖拽含有文件夹，全部阻止
            if (hasFolderInDropRef.current) {
              return Upload.LIST_IGNORE;
            }
            const fileMaxSize = convertToBytes(publicConfig.CLIENT_MAX_BODY_SIZE);

            if (!scowdEnabled && file.size > fileMaxSize) {
              message.error(t(p("maxSizeErrorMessage"), [file.name, publicConfig.CLIENT_MAX_BODY_SIZE]));
              return Upload.LIST_IGNORE;
            }

            return new Promise((resolve, reject) => {

              api.fileExist({ query: { cluster: cluster, path: join(path, file.name) } }).then(({ result }) => {
                if (result) {
                  modal.confirm({
                    title: t(p("existedModalTitle")),
                    content: t(p("existedModalContent"), [file.name]),
                    okText: t(p("existedModalOk")),
                    onOk: async () => {
                      const fileType = await api.getFileType({ query: { cluster: cluster, path: join(path, file.name) } });
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
          itemRender={(originNode, file) => {
            const speed = speedTracker.getFileSpeed(file.uid);
            const extraInfo = (file.percent && file.percent === 100) ? t(p("checking"))
              : speed?.speedText ?? "0 B/s";
            return (
              <div>
                {/* 原始的文件节点（包含进度条等） */}
                {originNode}
                {/* 只在scowd下展示下载进度及下载速度 */}
                {scowdEnabled && (
                  <PercentAndSpeedContainer>
                    {file.status === "uploading" && (
                      <span>{file.percent} % &nbsp;&nbsp; {extraInfo}</span>
                    )}
                  </PercentAndSpeedContainer>
                )}
              </div>
            );
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t(p("dragText"))}</p>
          <p className="ant-upload-hint">
            {t(p("hintText"))}
          </p>
        </Upload.Dragger>
      </div>
    </Modal>
  );
};
