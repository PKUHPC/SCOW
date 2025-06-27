import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { App, Button, Modal, Upload } from "antd";
import type { RcFile } from "antd/es/upload";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import { dirname, join } from "path";
import { useEffect, useRef, useState } from "react";
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

const p = prefix("pageComp.fileManagerComp.uploadDirModal.");
const pCommon = prefix("common.");

type OnProgressCallback = undefined | ((progressEvent: UploadProgressEvent) => void);

export const UploadDirModal: React.FC<Props> = ({ open, onClose, path, reload, cluster, scowdEnabled }) => {
  const { message, modal } = App.useApp();
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const uploadControllers = useRef(new Map<string, AbortController>());

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
  // 使用 Ref 保存前一次 uploadFileList 的内容
  const previousFileListRef = useRef<UploadFile[]>([]);

  const t = useI18nTranslateToString();

  useEffect(() => {
    if (open) {
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
              .httpError(409, () => {})
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
    for (const controller of Array.from(uploadControllers.current.values())) {
      controller.abort();
    }

    uploadControllers.current.clear();
    folderCheckPromisesRef.current.clear();
    folderOverwriteSetRef.current.clear();
    folderEnsureExistSetRef.current.clear();
    folderEnsureExistPromisesRef.current.clear();
    folderConfirmPromisesRef.current.clear();
    reload();
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

  const startMultipartUpload = async (file: RcFile, onProgress: OnProgressCallback) => {
    // 获取文件的相对路径或名称
    const relativePath = file.webkitRelativePath || file.name;
    const folderName = relativePath.split("/").slice(0, -1).join("/");
    const folderPath = join(path, folderName);

    const { tempFileDir, chunkSizeByte, filesInfo } = await api.initMultipartUpload({
      body: { cluster, path: folderPath, name: file.name },
    }).httpError(429, () => { message.error(t(pCommon("noSpaceError"))); });

    const uploadedChunkIndices = new Set(
      filesInfo
        .map((item) => {
          const reg = /_(\d+).scowuploadtemp/;
          const match = reg.exec(item.name);
          return match ? parseInt(match[1]) : null;
        })
        .filter((index) => index !== null),
    );

    const totalCount = Math.ceil(file.size / chunkSizeByte);
    let uploadedCount = uploadedChunkIndices.size;

    const uploadFile = uploadFileList.find((uploadFile) => uploadFile.uid === file.uid);
    if (!uploadFile) {
      message.error(t(p("uploadFileListNotExist"), [file.webkitRelativePath]));
      return;
    }

    const updateProgress = (count: number) => {
      uploadedCount += count;
      onProgress?.({ percent: Number(((uploadedCount / totalCount) * 100).toFixed(2)) });
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

      const response = await fetch(urlToUpload(cluster, join(tempFileDir, fileName), true, join(path, file.name)), {
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
        await api
          .mergeFileChunks({ body: { cluster, path: folderPath, name: file.name, sizeByte: file.size } })
          .httpError(520, (err) => {
            message.error(t(p("mergeFileChunksErrorText"), [file.webkitRelativePath]));
            throw err;
          });
      }
    } catch (err: any) {
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
      <Upload.Dragger
        directory
        name="file"
        multiple
        withCredentials
        {...(scowdEnabled ? {
          customRequest: ({ file, onSuccess, onError, onProgress }) => {
            startMultipartUpload(file as RcFile, onProgress).then(onSuccess).catch(onError);
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
          return true;
        }}
        fileList={uploadFileList}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t(p("dragText"))}</p>
        <p className="ant-upload-hint">{t(p("hintText"))}</p>
      </Upload.Dragger>
    </Modal>
  );
};
