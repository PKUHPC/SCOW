"use client";

import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { useUploadSpeedTracker } from "@scow/lib-web/build/utils/fileUpload/uploadSpeedHook";
import { calculateBlobSHA256, isDirectoryEntry, PercentAndSpeedContainer } from "@scow/lib-web/build/utils/fileUpload/uploadUtils";
import { App, Button, Modal, Upload, UploadFile } from "antd";
import { join } from "path";
import { useEffect, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc";

import { urlToUpload } from "../app/(auth)/files/api";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  clusterId: string;
  path: string;
  scowdEnabled: boolean;
}

interface UploadProgressEvent {
  percent: number;
}
type OnProgressCallback = undefined | ((progressEvent: UploadProgressEvent) => void);

export const UploadModal: React.FC<Props> = ({ open, onClose, path, reload, clusterId, scowdEnabled }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.uploadModal.");
  const pCommon = prefix("common.");

  const { message, modal } = App.useApp();
  const { publicConfig } = usePublicConfig();
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);

  const uploadControllers = useRef(new Map<string, AbortController>());
  // 使用上传文件的速度追踪器，速度更新时间 1000 ms
  const speedTracker = useUploadSpeedTracker(1000);

  // 判断当前拖拽是否有文件夹
  const hasFolderInDropRef = useRef(false);

  useEffect(() => {
    return () => {
      setUploadFileList([]);
    };
  }, [open]);

  const onModalClose = () => {
    for (const controller of Array.from(uploadControllers.current.values())) {
      controller.abort();
    }
    uploadControllers.current.clear();
    speedTracker.cleanupAll();

    onClose();
  };

  const deleteFileMutation = trpc.file.deleteItem.useMutation();

  const checkFileExist = trpc.file.checkFileExist.useMutation();
  const getFileType = trpc.file.getFileType.useMutation();
  const initMultipartUpload = trpc.file.initMultipartUpload.useMutation();
  const mergeFileChunks = trpc.file.mergeFileChunks.useMutation();

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
    const { tempFileDir, chunkSizeByte, filesInfo } = await initMultipartUpload.mutateAsync({
      clusterId, path, name: file.name,
    });
    const uploadedChunkIndices = new Set(
      filesInfo.map((item) => {
        const reg = /_(\d+).scowuploadtemp/;
        const match = reg.exec(item.name);
        return match ? parseInt(match[1]) : null;
      }).filter((index) => index !== null),
    );

    const totalCount = Math.ceil(file.size / chunkSizeByte);
    let uploadedCount = uploadedChunkIndices.size;

    const uploadFile = uploadFileList.find((uploadFile) => uploadFile.name === file.name);
    if (!uploadFile) {
      message.error(t(p("uploadFileListNotExist"), [file.name]));
      return;
    }

    // 计算已上传字节数
    const alreadyUploadedBytes = uploadedCount * chunkSizeByte;
    speedTracker.initFileSpeed(uploadFile.uid, alreadyUploadedBytes);

    const updateProgress = (count: number) => {
      uploadedCount += count;
      const percentage = Number(((uploadedCount / totalCount) * 100).toFixed(2));

      // 更新速度
      const currentTotalLoaded = uploadedCount * chunkSizeByte;
      speedTracker.updateFileBytes(uploadFile.uid, currentTotalLoaded);

      // 手动更新 fileList 中的percent
      setUploadFileList((prevList) => {
        return prevList.map((uploadFile) => {
          return uploadFile.name === file.name
            ? {
              ...uploadFile,
              percent: percentage,
              status: "uploading" as const,
            } : uploadFile;
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

      if (uploadedChunkIndices.has(start + 1)) {
        // 如果文件块已经上传，直接跳过
        return;
      }

      const chunk = file.slice(start * chunkSizeByte, (start + 1) * chunkSizeByte);
      const hash = await calculateBlobSHA256(chunk);
      const fileName = `${hash}_${start + 1}.scowuploadtemp`;

      const formData = new FormData();
      formData.append("file", chunk);

      const response = await fetch(urlToUpload(clusterId, join(tempFileDir, fileName), publicConfig.BASE_PATH,
        true, join(path, file.name)), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      updateProgress(1);

    };

    try {
      // 顺序上传分片，失败时立即终止
      for (let i = 0; i < totalCount; i++) {
        if (controller.signal.aborted) {
          break;
        }

        // 如果分片已经上传过，跳过
        if (uploadedChunkIndices.has(i + 1)) {
          continue;
        }

        await uploadChunk(i);
      }

      if (!controller.signal.aborted) {
        try {
          await mergeFileChunks.mutateAsync({ clusterId, path, name: file.name, sizeByte: file.size });
        } catch (err: any) {
          message.error(t(p("mergeFileChunkError"), [file.name, err.message]));
        }
      }

    } catch (err: any) {
      if (err?.data?.code === "TOO_MANY_REQUESTS") {
        message.error(t(pCommon("noSpaceError")));
      } else {
        message.error(t(p("fileUploadError"), [err.message]));
      }
      throw err;
    } finally {
      uploadControllers.current.delete(uploadFile.uid);
      speedTracker.cleanupFile(uploadFile.uid);
    }
  };


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

      {!scowdEnabled && (
        <p>
          {t(p("maxSize"))}：<span>{publicConfig.CLIENT_MAX_BODY_SIZE}</span>。
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
          {
          ...(scowdEnabled ? {
            customRequest: ({ file, onSuccess, onError, onProgress }) => {
              startMultipartUpload(file as File, onProgress).then(onSuccess).catch(onError);
            },
          } : {
            action: async (file) => urlToUpload(clusterId, join(path, file.name), publicConfig.BASE_PATH),
          })
          }
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
                  : (
                    <DeleteOutlined title={t(p("delRecord"))} />
                  )
              );
            },
          }}
          onChange={({ file, fileList }) => {
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
            // 本次拖拽含有文件夹，全部阻止
            if (hasFolderInDropRef.current) {
              return Upload.LIST_IGNORE;
            }
            const fileMaxSize = parseInt(publicConfig.CLIENT_MAX_BODY_SIZE.slice(0, -1)) * (1024 ** 3);

            if (!scowdEnabled && file.size > fileMaxSize) {
              message.error(`${file.name}${t(p("failed"))},${t(p("exceed"))}${publicConfig.CLIENT_MAX_BODY_SIZE}`);
              return Upload.LIST_IGNORE;
            }

            return new Promise((resolve, reject) => {
              checkFileExist.mutateAsync({ path: join(path, file.name), clusterId }).then(({ exists }) => {
                if (exists) {
                  modal.confirm({
                    title: t(p("alreadyExisted")),
                    content: t(p("confirmText"), [file.name]),
                    okText: t("button.confirmButton"),
                    onOk: async () => {
                      const fileType = await getFileType.mutateAsync({ path: join(path, file.name), clusterId });

                      if (fileType.type) {
                        await deleteFileMutation.mutateAsync({
                          target: fileType.type === "DIR" ? "DIR" : "FILE",
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
          itemRender={(originNode, file) => {
            const speed = speedTracker.getFileSpeed(file.uid);
            const extraInfo = (file.percent && file.percent === 100) ? t(p("isMerging"))
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
          <p className="ant-upload-text">{t(p("uploadText"))}</p>
          <p className="ant-upload-hint">
            {t(p("singleOrMultiply"))}
          </p>
        </Upload.Dragger>
      </div>
    </Modal>
  );
};
