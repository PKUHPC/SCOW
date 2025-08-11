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

"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, Modal, Upload, UploadFile } from "antd";
import { join } from "path";
import { useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc.js";

import { urlToUpload } from "../app/(auth)/files/api";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  clusterId: string;
  path: string;
}

enum FileType {
  FILE = "file",
  DIR = "dir",
}

export const UploadModal: React.FC<Props> = ({ open, onClose, path, reload, clusterId }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.uploadModal.");
  const pCommon = prefix("common.");

  const { message, modal } = App.useApp();
  const { publicConfig } = usePublicConfig();
  const [ uploadFileList, setUploadFileList ] = useState<UploadFile[]>([]);

  const onModalClose = () => {
    setUploadFileList([]);
    onClose();
  };

  const deleteFileMutation = trpc.file.deleteItem.useMutation();

  const checkFileExist = trpc.file.checkFileExist.useMutation();
  const getFileType = trpc.file.getFileType.useMutation();

  return (
    <Modal
      open={open}
      title={t(p("upload"))}
      onCancel={onModalClose}
      destroyOnClose={true}
      maskClosable={false}
      footer={[
        <Button key="close" onClick={onModalClose}>
          {t(p("close"))}
        </Button>,
      ]}
    >
      <p>
        {t(p("uploadTo"))}：<span>{path}</span>。{t(p("covered"))}。
      </p>
      <p>
        {t(p("maxSize"))}：<span>{publicConfig.CLIENT_MAX_BODY_SIZE}</span>。
      </p>
      <Upload.Dragger
        name="file"
        multiple
        action={async (file) => urlToUpload(clusterId, join(path, file.name), publicConfig.BASE_PATH)}
        withCredentials
        showUploadList={{
          removeIcon: (file) => {
            return (
              <DeleteOutlined title={file.status === "uploading" ? "取消上传" : "删除上传记录"} />
            );
          },
        }}
        onChange={({ file, fileList }) => {
          console.log(fileList);
          const updatedFileList = [...fileList.filter((f) => f.status)];
          setUploadFileList(updatedFileList);

          if (file.status === "done") {
            message.success(`${file.name}${t(p("success"))}`);
            reload();
          } else if (file.status === "error") {
            // 优先使用 response 中的消息，如果没有则回退到 error.message
            const errorMsg = file.response?.message || // 后端主动返回的 message
                              file.error?.message || // 网络或异常错误
                              `${file.name}${t(p("failed"))}`; // 默认提示


            message.error(file.response?.code === "TOO_MANY_REQUESTS" ? t(pCommon("noSpaceError")) : errorMsg);
          }
        }}
        beforeUpload={(file) => {
          const fileMaxSize = parseInt(publicConfig.CLIENT_MAX_BODY_SIZE.slice(0, -1)) * (1024 ** 3);

          if (file.size > fileMaxSize) {
            message.error(`${file.name}${t(p("failed"))},${t(p("exceed"))}${publicConfig.CLIENT_MAX_BODY_SIZE}`);
            return Upload.LIST_IGNORE;
          }

          return new Promise((resolve, reject) => {
            checkFileExist.mutateAsync({ path:join(path, file.name), clusterId }).then(({ exists }) => {
              if (exists) {
                modal.confirm({
                  title: t(p("alreadyExisted")),
                  content: t(p("confirmText"),[file.name]),
                  okText: t("button.confirmButton"),
                  onOk: async () => {
                    const fileType = await getFileType.mutateAsync({ path:join(path, file.name), clusterId });

                    if (fileType.type) {
                      await deleteFileMutation.mutateAsync({
                        target: fileType.type === FileType.DIR ? "DIR" : "FILE",
                        clusterId: clusterId,
                        path: join(path, file.name),
                      }).then(() => resolve(file));
                    }

                  },
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
        <p className="ant-upload-text">{t(p("uploadText"))}</p>
        <p className="ant-upload-hint">
          {t(p("singleOrMultiply"))}
        </p>
      </Upload.Dragger>
    </Modal>
  );
};
