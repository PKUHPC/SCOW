import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { useUploadSpeedTracker } from "@scow/lib-web/build/utils/fileUpload/uploadSpeedHook";
import { isFileEntry, PercentAndSpeedContainer } from "@scow/lib-web/build/utils/fileUpload/uploadUtils";
import { App, Button, Modal, Upload } from "antd";
import type { RcFile } from "antd/es/upload";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import pLimit from "p-limit";
import { dirname, join } from "path";
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

const p = prefix("pageComp.fileManagerComp.uploadDirModal.");
const pCommon = prefix("common.");

type OnProgressCallback = undefined | ((progressEvent: UploadProgressEvent) => void);

export const UploadDirModal: React.FC<Props> = ({ open, onClose, path, reload, cluster, scowdEnabled }) => {
  const { message, modal } = App.useApp();
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const uploadFileListRef = useRef<UploadFile[]>([]);
  const uploadControllers = useRef(new Map<string, AbortController>());
  const limit = useRef(pLimit(2));
  const uploadSessionRef = useRef(0);

  // 使用 ref 来追踪每个文件夹的覆盖确认状态
  const folderOverwriteSetRef = useRef<Set<string>>(new Set());
  // 用于缓存文件夹存在性检查的 Promise
  const folderCheckPromisesRef = useRef<Map<string, Promise<boolean>>>(new Map());
  // 使用 ref 存储已经确认过已存在的目录
  const folderEnsureExistSetRef = useRef<Set<string>>(new Set());
  // 用于缓存目录创建的 Promise
  const folderEnsureExistPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  // 用于缓存每个文件夹的确认 Promise
  const folderConfirmPromisesRef = useRef<Map<string, Promise<"overwrite" | "skip">>>(new Map());
  // 用于缓存文件夹删除的 Promise
  const folderDeletePromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  // 用于追踪已经删除的文件夹
  const folderDeletedSetRef = useRef<Set<string>>(new Set());
  // 使用 Ref 保存前一次 uploadFileList 的内容
  const previousFileListRef = useRef<UploadFile[]>([]);

  // 使用上传文件的速度追踪器，速度更新时间 1000 ms
  const speedTracker = useUploadSpeedTracker(1000);

  const t = useI18nTranslateToString();

  // 判断当前拖拽是否有文件
  const hasFileInDropRef = useRef(false);

  useEffect(() => {
    uploadFileListRef.current = uploadFileList;
  }, [uploadFileList]);

  useEffect(() => {
    if (open) {
      uploadSessionRef.current += 1;
      limit.current.clearQueue();
      setUploadFileList([]);
    }
    return () => {
      setUploadFileList([]);
    };
  }, [open]);

  /**
   * 检查是否有新的文件夹上传
   * 如果是的话则清除 folderOverwriteSetRef 和 folderEnsureExistSetRef
   */
  useEffect(() => {
    const previousFileList = previousFileListRef.current;
    const currentFileList = uploadFileList;

    // Check if new files are added
    const isNewUpload =
      previousFileList.length === 0 && currentFileList.length > 0 ||
      previousFileList.length > 0 && currentFileList.length > previousFileList.length;

    if (isNewUpload) {
      folderOverwriteSetRef.current.clear();
      folderEnsureExistSetRef.current.clear();
      folderDeletedSetRef.current.clear();
    }

    previousFileListRef.current = currentFileList;
  }, [uploadFileList]);

  /**
   * 显示文件夹覆盖确认对话框
   * @param folderName 文件夹名称
   * @returns 用户的选择
   */
  const showConfirmForFolderOverwrite = (folderName: string): Promise<"overwrite" | "skip"> => {
    return new Promise((resolve) => {
      modal.confirm({
        title: t(p("existedModalTitle")),
        content: t(p("existedModalContent"), [folderName]),
        okText: t(p("existedModalOk")),
        cancelText: t(p("existedModalCancel")),
        maskClosable: false,
        centered: true,
        onOk: () => resolve("overwrite"),
        onCancel: () => resolve("skip"),
      });
    });
  };

  /**
   * 检查文件夹是否存在
   * @param folderPath 文件夹名称
   * @returns 文件夹是否存在
   */
  const checkFolderExists = async (folderPath: string): Promise<boolean> => {
    // If a check is already in progress, return the existing promise
    if (folderCheckPromisesRef.current.has(folderPath)) {
      return folderCheckPromisesRef.current.get(folderPath)!;
    }

    // Create a new check promise and cache it
    const checkPromise = (async () => {
      try {
        const { result } = await api.fileExist({ query: { cluster, path: folderPath } });
        return result;
      } catch {
        message.error(t(p("existedCheckFailed"), [folderPath]));
        return false;
      }
    })().finally(() => {
      folderCheckPromisesRef.current.delete(folderPath);
      message.destroy("checkDir");
    });

    folderCheckPromisesRef.current.set(folderPath, checkPromise);

    return checkPromise;
  };


  /**
   * 确保目录存在，如果不存在则创建它
   * @param folderPath 目录路径
   */
  const ensureDirectoryExists = async (folderPath: string): Promise<void> => {
    // If a creation is already in progress, return the existing promise
    if (folderEnsureExistPromisesRef.current.has(folderPath)) {
      return folderEnsureExistPromisesRef.current.get(folderPath)!;
    }

    // Create a new ensure promise and cache it
    const ensurePromise = (async () => {
      if (!folderEnsureExistSetRef.current.has(folderPath)) {
        const exists = await checkFolderExists(folderPath);
        if (!exists) {
          try {
            await api.mkdir({ body: { cluster, path: folderPath } })
              .httpError(409, () => { })
              .httpError(429, () => {
                message.error(t(pCommon("noSpaceError")));
              });
          } catch {
            /* Handle mkdir error if necessary */
          }
        }
        folderEnsureExistSetRef.current.add(folderPath);
      }
    })().finally(() => {
      folderEnsureExistPromisesRef.current.delete(folderPath);
    });

    folderEnsureExistPromisesRef.current.set(folderPath, ensurePromise);

    return ensurePromise;
  };

  /**
   * 在 beforeUpload 中判断是否需要上传
   * 针对每个文件夹进行独立的覆盖检查和文件夹创建
   */
  const beforeUploadHandler = async (file: RcFile): Promise<boolean | string> => {
    // 本次拖拽含有文件，全部阻止
    if (hasFileInDropRef.current) {
      return Upload.LIST_IGNORE;
    }
    // 获取文件的相对路径或名称
    const relativePath = file.webkitRelativePath || file.name;
    const folderName = relativePath.split("/")[0];
    const folderPath = join(path, folderName);
    // 检查文件大小
    const fileMaxSize = convertToBytes(publicConfig.CLIENT_MAX_BODY_SIZE);

    if (!scowdEnabled && file.size > fileMaxSize) {
      message.error(t(p("maxSizeErrorMessage"), [file.webkitRelativePath, publicConfig.CLIENT_MAX_BODY_SIZE]));
      return Upload.LIST_IGNORE;
    }

    // 检查该文件夹的覆盖状态
    if (!folderOverwriteSetRef.current.has(folderPath)) {
      // 未检查过该文件夹，进行存在性检查
      const exists = await checkFolderExists(folderPath);

      if (exists) {
        // 检查是否已经有一个确认正在进行
        let confirmPromise = folderConfirmPromisesRef.current.get(folderPath);
        if (!confirmPromise) {
          // 如果没有，创建一个新的确认 Promise 并缓存
          confirmPromise = showConfirmForFolderOverwrite(folderPath);
          folderConfirmPromisesRef.current.set(folderPath, confirmPromise);
        }
        const userChoice = await confirmPromise;
        // 一旦确认完成，移除缓存的 Promise
        folderConfirmPromisesRef.current.delete(folderPath);

        if (userChoice === "overwrite") {
          // 删除已存在的文件夹（同一文件夹只执行一次，通过 Promise 缓存保证并发安全）
          if (!folderDeletedSetRef.current.has(folderPath)) {
            let deletePromise = folderDeletePromisesRef.current.get(folderPath);
            if (!deletePromise) {
              deletePromise = api.deleteDir({ query: { cluster, path: folderPath } })
                .then(() => {})
                .catch(() => {
                  message.error(t(p("deleteFolderFailed"), [folderName]));
                })
                .finally(() => {
                  folderDeletePromisesRef.current.delete(folderPath);
                  folderDeletedSetRef.current.add(folderPath);
                });
              folderDeletePromisesRef.current.set(folderPath, deletePromise);
            }
            await deletePromise;
          }
          folderOverwriteSetRef.current.add(folderPath);
        } else {
          return Upload.LIST_IGNORE;
        }
      } else {
        // 文件夹不存在，允许上传
        folderOverwriteSetRef.current.add(folderPath);
      }
    }

    // 如果允许上传该文件夹，确保父目录存在
    if (folderOverwriteSetRef.current.has(folderPath)) {
      // 获取文件的父目录路径
      const filePath = join(path, relativePath);
      const parentDir = dirname(filePath);
      try {
        await ensureDirectoryExists(parentDir);
        return true;
      } catch {
        // 目录创建失败，忽略上传
        return Upload.LIST_IGNORE;
      }
    }

    return Upload.LIST_IGNORE;
  };

  /**
   * 当文件列表变化时，自动开始上传
   * 由于我们使用 customRequest，Upload 组件会自动调用 customRequest
   */
  const handleChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setUploadFileList(newFileList);
  };

  const onModalClose = () => {
    uploadSessionRef.current += 1;
    limit.current.clearQueue();
    for (const controller of Array.from(uploadControllers.current.values())) {
      controller.abort();
    }

    uploadControllers.current.clear();
    folderCheckPromisesRef.current.clear();
    folderOverwriteSetRef.current.clear();
    folderEnsureExistSetRef.current.clear();
    folderEnsureExistPromisesRef.current.clear();
    folderConfirmPromisesRef.current.clear();
    folderDeletePromisesRef.current.clear();
    folderDeletedSetRef.current.clear();
    speedTracker.cleanupAll();
    reload();
    onClose();
  };

  const handleRemove = (file: UploadFile) => {
    const controller = uploadControllers.current.get(file.uid);
    if (controller) {
      controller.abort();
      uploadControllers.current.delete(file.uid);
    }
    speedTracker.cleanupFile(file.uid);

    return true;
  };

  const startMultipartUpload = async (file: RcFile, onProgress: OnProgressCallback) => {
    // 获取文件的相对路径或名称
    const relativePath = file.webkitRelativePath || file.name;
    const folderName = relativePath.split("/").slice(0, -1).join("/");
    const folderPath = join(path, folderName);

    let initData = await api.initMultipartUpload({
      body: {
        cluster, path: folderPath, name: file.name,
        fileSizeByte: file.size, modificationTime: file.lastModified,
      },
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
              await api.deleteFile({ query: { cluster, path: join(folderPath, file.name + ".uploading") } });
            } catch (e) {
              console.error("Failed to delete .uploading file", e);
            }

            initData = await api.initMultipartUpload({
              body: {
                cluster, path: folderPath, name: file.name,
                fileSizeByte: file.size, modificationTime: file.lastModified,
              },
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

    let loadedBytes = 0;
    uploadedChunkIndices.forEach((index) => {
      if (index === totalCount) {
        loadedBytes += (file.size - (totalCount - 1) * chunkSizeByte);
      } else {
        loadedBytes += chunkSizeByte;
      }
    });

    const uploadFile = uploadFileListRef.current.find((uploadFile) => uploadFile.uid === file.uid);
    if (!uploadFile) { return; }

    speedTracker.initFileSpeed(uploadFile.uid, loadedBytes);

    const updateProgress = (chunkSize: number) => {
      loadedBytes += chunkSize;
      const percentage = Number(((loadedBytes / file.size) * 100).toFixed(2));

      speedTracker.updateFileBytes(uploadFile.uid, loadedBytes);

      setUploadFileList((prevList) => {
        return prevList.map((uploadFile) => {
          return uploadFile.uid === file.uid
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

      const response = await fetch(urlToUpload(cluster, join(path, relativePath), true, undefined, start), {
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
        await api
          .completeMultipartUpload({ body: { cluster, path: folderPath, name: file.name } })
          .httpError(429, () => { message.error(t(pCommon("noSpaceError"))); })
          .httpError(520, (err) => {
            message.error(t(p("completeUploadErrorText"), [file.name, err?.error]));
          });
      }
    } catch (err: any) {
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
        {t(p("pathMention"))}<strong>{path}</strong>
        {t(p("uploadRemark2"))}
      </p>
      {!scowdEnabled && (
        <p>
          {t(p("uploadRemark3"))}
          <strong>{publicConfig.CLIENT_MAX_BODY_SIZE}</strong>
          {t(p("uploadRemark4"))}
        </p>
      )}
      <div
        onDropCapture={(event) => {
          const droppedItems = Array.from(event.dataTransfer?.items ?? []);
          const hasFile = droppedItems.some((item) => isFileEntry(item));
          // 捕获阶段先于 Upload 内部处理，确保 beforeUpload 读到的是本次 drop 的值
          hasFileInDropRef.current = hasFile;
          if (hasFile) {
            // 阻止事件到达 Upload.Dragger，避免其尝试处理含文件的 drop
            event.preventDefault();
            event.stopPropagation();
            message.error(t(p("isNotDir")));
          }
        }}
        onClickCapture={() => {
          // 点击打开文件夹选择框时重置，避免上次 file drop 污染点击上传
          hasFileInDropRef.current = false;
        }}
      >
        <Upload.Dragger
          directory
          name="file"
          multiple
          withCredentials
          {...(scowdEnabled ? {
            customRequest: ({ file, onSuccess, onError, onProgress }) => {
              const session = uploadSessionRef.current;
              limit.current(async () => {
                if (session !== uploadSessionRef.current) { return; }
                await startMultipartUpload(file as RcFile, onProgress);
              }).then(onSuccess).catch(onError);
            },
          } : {
            action: async (file) => urlToUpload(cluster, join(path, file.webkitRelativePath)),
          })}
          showUploadList={{
            removeIcon: (file) => {
              return file.status === "uploading" ? (
                <DeleteOutlined
                  onClick={scowdEnabled ? () => handleRemove(file) : undefined}
                  title={t(p("cancelUpload"))}
                />
              ) : (
                <DeleteOutlined title={t(p("deleteUploadRecords"))} />
              );
            },
          }}
          beforeUpload={beforeUploadHandler}
          onChange={handleChange}
          onRemove={(file) => {
            setUploadFileList((prev) => prev.filter((item) => item.uid !== file.uid));
            speedTracker.cleanupFile(file.uid);
            return true;
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
                <PercentAndSpeedContainer>
                  {file.status === "uploading" && (
                    <span>{file.percent} % &nbsp;&nbsp; {extraInfo}</span>
                  )}
                </PercentAndSpeedContainer>
              </div>
            );
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t(p("dragText"))}</p>
          <p className="ant-upload-hint">{t(p("hintText"))}</p>
        </Upload.Dragger>
      </div>
    </Modal>
  );
};
