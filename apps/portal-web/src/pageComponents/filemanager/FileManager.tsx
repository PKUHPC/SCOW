import { CheckCircleFilled, ExclamationCircleFilled, DownOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { FileBrowserLayout } from "@scow/lib-web/build/components/filemanager/FileBrowserLayout";
import {
  FILE_MANAGER_TOP_OFFSET_PX,
  OperationBar,
  SelectPreFix,
  StorageInfoSection,
  TopBar,
  TopCard,
  UpButtonBox,
} from "@scow/lib-web/build/components/filemanager/FileManagerLayout";
import { FileTableWrapper } from "@scow/lib-web/build/components/filemanager/FileTableWrapper";
import { PathBar } from "@scow/lib-web/build/components/filemanager/PathBar";
import { RoundedButton as Button } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { RoundedModalButton } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { useAutoSelectSidebar } from "@scow/lib-web/build/hooks/useAutoSelectSidebar";
import { useSelectedStorageConfig } from "@scow/lib-web/build/hooks/useSelectedStorageConfig";
import {
  CompressIcon,
  CopyIcon,
  CreateIcon,
  DecompressIcon,
  EntryPathIcon,
  DeleteIcon as FileDeleteIcon,
  DownloadIcon as FileDownloadIcon,
  ForwardIcon,
  HomeDirIcon,
  MoveIcon,
  OpenInShellIcon,
  PasteIcon,
  StorageIcon,
  UploadIcon,
} from "@scow/lib-web/build/icons/FileIcon";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { formatMBToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { isExecutableScriptFilename, isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import {
  buildEnrichedEntryPaths,
  getClusterStorageConfigs,
  hasClusterQuotaEnabledStorage,
} from "@scow/lib-web/build/utils/storageClusterHelper";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Divider, Dropdown, MenuProps, Progress, Select, Space, Switch, Tooltip } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import { basename, dirname, join } from "path";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis/api";
import { ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { DeleteIcon, DownloadIcon, RenameIcon, SubmitIcon } from "src/icons/operationIcon";
import { urlToCompressAndDownload, urlToDownload } from "src/pageComponents/filemanager/api";
import { CompressFilesModal } from "src/pageComponents/filemanager/CompressFilesModal";
import { CreateFileModal } from "src/pageComponents/filemanager/CreateFileModal";
import { FileEditModal } from "src/pageComponents/filemanager/FileEditModal";
import { FileTable } from "src/pageComponents/filemanager/FileTable";
import { ImagePreviewer } from "src/pageComponents/filemanager/ImagePreviewer";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { RenameModal } from "src/pageComponents/filemanager/RenameModal";
import { UploadDirModal } from "src/pageComponents/filemanager/UploadDirModal";
import { UploadModal } from "src/pageComponents/filemanager/UploadModal";
import { FileInfo } from "src/pages/api/file/list";
import { isDecompressibleFile } from "src/server/file";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { UserStore } from "src/stores/UserStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { convertToBytes } from "src/utils/format";
import styled, { useTheme } from "styled-components";

import { DecompressFilesModal } from "./DecompressFilesModal";

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ProgressPercentage = styled.span`
  color: ${({ theme }) => theme.token.colorPrimary};
  white-space: nowrap;
`;

const StorageUsageText = styled.div<{ $marginBottom?: number }>`
  font-size: 12px;
  color: ${({ theme }) => theme.token.colorTextSecondary};
  ${({ $marginBottom }) => ($marginBottom !== undefined ? `margin-bottom: ${$marginBottom}px;` : "")}
`;

interface Props {
  initialCluster: Cluster;
  path: string;
  urlPrefix: string;
}

interface PromiseSettledResult {
  status: string;
  value?: FileInfo | undefined;
}

interface HomePathInfo {
  clusterId: string;
  homePath: string;
}

const DEFAULT_FILE_PREVIEW_LIMIT_SIZE = "50m";

type FileInfoKey = React.Key;

const fileInfoKey = (f: FileInfo, path: string): FileInfoKey => join(path, f.name);

interface Operation {
  op: "copy" | "move";
  originalPath: string;
  started: boolean;
  selected: FileInfo[];
  completed: FileInfo[];
}

export interface Compression {
  started: string[];
  completed: string[];
}

export interface DeCompression {
  decompressionStarted: string[];
  decompressionCompleted: string[];
}

const p = prefix("pageComp.fileManagerComp.fileManager.");
const pCommon = prefix("common.");

enum UploadType {
  File = "file",
  Dir = "dir",
}

export const FileManager: React.FC<Props> = ({ initialCluster, path, urlPrefix }) => {
  const router = useRouter();

  const t = useI18nTranslateToString();

  const operationTexts = {
    copy: t(p("moveCopy.copy")),
    move: t(p("moveCopy.move")),
  };

  const { message, modal } = App.useApp();

  const languageId = useI18n().currentLanguage.id;

  const theme = useTheme();

  const prevPathRef = useRef<string>(path);

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<FileInfoKey[]>([]);
  const currentClusterRef = useRef<Cluster>(initialCluster);

  const [homePaths, setHomePaths] = useState<HomePathInfo[]>([]);
  const [previewFile, setPreviewFile] = useState({
    open: false,
    filename: "",
    fileSize: 0,
    filePath: "",
    clusterId: "",
  });
  const [previewImage, setPreviewImage] = useState({
    visible: false,
    src: "",
    scaleStep: 0.5,
  });
  const { currentClusters } = useStore(ClusterInfoStore);
  const [operation, setOperation] = useState<Operation | undefined>(undefined);
  const [compression, setCompression] = useState<Compression>({ started: [], completed: [] });
  const [showHiddenFile, setShowHiddenFile] = useState(false);
  const [submitSuccessJobId, setSubmitSuccessJobId] = useState<number | null>(null);
  const [submitConfirmInfo, setSubmitConfirmInfo] = useState<{
    fileName: string;
    fullPath: string;
    targetClusterId: string;
    targetClusterName: string;
  } | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [decompression, setDecompression] = useState<DeCompression>({
    decompressionStarted: [],
    decompressionCompleted: [],
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { user } = useStore(UserStore);
  const { loginNodes } = useStore(LoginNodeStore);
  const { fullClusterConfigs } = useStore(ClusterInfoStore);
  const loginNode = loginNodes[currentClusterRef.current.id][0].address;

  // 获取当前集群下快捷路径入口列表（含 storageId，用于侧边栏选中后展示配额）
  const enrichedEntryPaths = useMemo(() => {
    const currentClusterId = currentClusterRef.current.id;
    const clusterConfig = fullClusterConfigs[currentClusterId];
    return buildEnrichedEntryPaths(clusterConfig?.entryPaths, user?.identityId);
  }, [fullClusterConfigs, currentClusterRef.current.id, user?.identityId]);

  // 判断当前集群下是否存在配置了限额的存储系统
  const showQuotaInfo = useMemo(() => {
    const currentClusterId = currentClusterRef.current.id;
    const clusterConfig = fullClusterConfigs[currentClusterId];
    return hasClusterQuotaEnabledStorage(clusterConfig.entryPaths, publicConfig.PUBLIC_STORAGE_CONFIG);
  }, [fullClusterConfigs, currentClusterRef.current.id]);

  // 获取当前集群下各存储的配置信息（含 displayName、replicaExist 等）
  const clusterStorageConfigs = useMemo(() => {
    const currentClusterId = currentClusterRef.current.id;
    const clusterConfig = fullClusterConfigs[currentClusterId];
    if (!clusterConfig.entryPaths || !publicConfig.PUBLIC_STORAGE_CONFIG) return [];
    return getClusterStorageConfigs(clusterConfig.entryPaths, publicConfig.PUBLIC_STORAGE_CONFIG);
  }, [fullClusterConfigs, currentClusterRef.current.id]);

  const promiseFn = useCallback(async () => {
    if (!showQuotaInfo) return undefined;
    const { storageInfos } = await api.getUserStorageInfo({
      query: {
        cluster: currentClusterRef.current.id,
      },
    });
    return storageInfos;
  }, [showQuotaInfo, currentClusterRef.current.id]);

  const { data: storageInfos } = useAsync({ promiseFn, watch: currentClusterRef.current.id });

  // 确保初始加载时家目录路径已缓存（用于侧边栏的最长前缀匹配）
  useEffect(() => {
    const clusterId = currentClusterRef.current.id;
    if (!homePaths.find((h) => h.clusterId === clusterId)) {
      api
        .getHomeDirectory({ query: { cluster: clusterId } })
        .then((res) => {
          setHomePaths((prev) => [...prev, { clusterId, homePath: res.path }]);
        })
        .catch(() => {});
    }
  }, []);

  const currentHomePath = homePaths.find((h) => h.clusterId === currentClusterRef.current.id)?.homePath;
  const selectedEntryIndex = useAutoSelectSidebar(path, currentHomePath, enrichedEntryPaths);

  const selectedStorageConfig = useSelectedStorageConfig(path, clusterStorageConfigs);

  // 当前路径对应的存储配额信息：仅在 showQuotaInfo 时有效
  const selectedStorageInfo = useMemo(() => {
    if (!storageInfos || !selectedStorageConfig) return null;
    const info = storageInfos.find((i) => i.storageId === selectedStorageConfig.storageId);
    if (!info) return null;
    return { info, config: selectedStorageConfig };
  }, [storageInfos, selectedStorageConfig]);

  const CompressFilesButton = RoundedModalButton(CompressFilesModal, {
    icon: <CompressIcon disabled={selectedKeys.length === 0} />,
    disabled: selectedKeys.length === 0,
    $color: theme.palette.gray[8],
  });

  const DecompressFilesButton = RoundedModalButton(DecompressFilesModal, {
    icon: (
      <DecompressIcon
        disabled={
          selectedKeys.length === 0 ||
          selectedKeys.some((sKey) => !isDecompressibleFile(sKey.toString()))
        }
      />
    ),
    disabled: selectedKeys.length === 0 || selectedKeys.some((sKey) => !isDecompressibleFile(sKey.toString())),
    $color: theme.palette.gray[8],
  });

  const getDecompressButtonDisabledReason = () => {
    if (selectedKeys.length > 0 && selectedKeys.some((sKey) => !isDecompressibleFile(sKey.toString()))) {
      return t(p("decompressButtonDisabledTooltip"));
    }
    return "";
  };

  const reload = async (signal?: AbortSignal) => {
    setLoading(true);
    await api
      .listFile({ query: { cluster: currentClusterRef.current.id, path } }, signal)
      .httpError(403, (e) => {
        message.error(t(p("noAccessPermission")));
        throw e;
      })
      .httpError(412, (e) => {
        message.error(t(p("noPath")));
        throw e;
      })
      .httpError(503, (e) => {
        message.error(t(p("entryPathCreateFailed")));
        throw e;
      })
      .then((d) => {
        setFiles(d.items);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fullUrl = (path: string) => {
    return join(urlPrefix, currentClusterRef.current.id, path);
  };

  const up = () => {
    const paths = path.split("/");

    const newPath = paths.length === 1 ? path : "/" + paths.slice(0, paths.length - 1).join("/");

    router.push(fullUrl(newPath));
  };

  const toHome = async (clusterId: string) => {
    const currentClusterId = clusterId;
    const homePathInfo = homePaths.find((item) => item.clusterId === currentClusterId);
    const currentPath = path;
    if (homePathInfo) {
      router.push(fullUrl(homePathInfo.homePath));
      if (homePathInfo.homePath === currentPath) {
        reload();
      }
    } else {
      await api
        .getHomeDirectory({ query: { cluster: currentClusterId } })
        .then((res) => {
          setHomePaths((homePaths) => [...homePaths, { clusterId: currentClusterId, homePath: res?.path }]);
          router.push(fullUrl(res?.path ?? ""));
          if (res?.path === currentPath) {
            reload();
          }
        })
        .catch((e) => {
          message.error(e);
        });
    }
  };

  useEffect(() => {
    if (path === "~") {
      return;
    }

    setSelectedKeys([]);

    reload()
      .then(() => {
        prevPathRef.current = path;
      })
      .catch(() => {
        if (prevPathRef.current !== path) {
          router.push(fullUrl(prevPathRef.current));
        }
      });
  }, [path]);

  const resetSelectedAndOperation = () => {
    setSelectedKeys([]);
    setOperation(undefined);
  };

  const paste = async () => {
    if (!operation) {
      return;
    }

    const operationText = operationTexts[operation.op];

    setOperation({ ...operation, started: true });

    const operationApi = operation.op === "copy" ? api.copyFileItem : api.moveFileItem;

    const pasteFile = async (file: FileInfo, fromPath: string, toPath: string) => {
      await operationApi({ body: { cluster: currentClusterRef.current.id, fromPath, toPath } })
        .httpError(415, ({ error }) => {
          modal.error({
            title: t(p("moveCopy.modalErrorTitle"), [file.name, operationText]),
            content: error,
          });
          throw error;
        })
        .httpError(429, () => {
          message.error(t(pCommon("noSpaceError")));
        })
        .httpError(400, ({ code, error }) => {
          if (code === "INVALID_ARGUMENT") {
            modal.error({
              title: t(p("moveCopy.modalErrorTitle"), [file.name, operationText]),
              content: t(p("moveCopy.moveCopyToItselfError")),
            });
          }
          throw error;
        })
        .then(() => {
          setOperation((o) => (o ? { ...operation, completed: o.completed.concat(file) } : undefined));
          return file;
        })
        .catch((e) => {
          throw e;
        });
    };

    let successfulCount: number = 0;
    let abandonCount: number = 0;
    const allCount = operation.selected.length;
    for (const x of operation.selected) {
      try {
        const exists = await api.fileExist({
          query: { cluster: currentClusterRef.current.id, path: join(path, x.name) },
        });
        if (exists.result) {
          const fileType = await api.getFileType({
            query: { cluster: currentClusterRef.current.id, path: join(path, x.name) },
          });
          const isDir = fileType.type === "dir" || fileType.type === "DIR";
          await new Promise<void>((res) => {
            modal.confirm({
              title: t(p(isDir ? "moveCopy.existedDirModalTitle" : "moveCopy.existedFileModalTitle")),
              content: t(
                p(
                  operation.op === "copy"
                    ? isDir
                      ? "moveCopy.copyDirModalContent"
                      : "moveCopy.copyFileModalContent"
                    : isDir
                      ? "moveCopy.moveDirModalContent"
                      : "moveCopy.moveFileModalContent",
                ),
                [x.name],
              ),
              okText: t(p("moveCopy.existedModalOk")),
              onOk: async () => {
                const deleteOperation = isDir ? api.deleteDir : api.deleteFile;
                await deleteOperation({
                  query: { cluster: currentClusterRef.current.id, path: join(path, x.name) },
                }).httpError(403, (e) => {
                  if (e.code === "FORBIDDEN") {
                    message.error(`${t(p("noAccessPermission"))}: ${e.error}`);
                    throw e;
                  } else {
                    message.error(e.error);
                    throw e;
                  }
                });
                await pasteFile(x, join(operation.originalPath, x.name), join(path, x.name));
                successfulCount++;
                res();
              },
              onCancel: async () => {
                abandonCount++;
                res();
              },
            });
          });
        } else {
          await pasteFile(x, join(operation.originalPath, x.name), join(path, x.name));
          successfulCount++;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (allCount - successfulCount - abandonCount) {
      message.error(
        t(p("moveCopy.errorMessage"), [
          operationText,
          allCount,
          successfulCount,
          abandonCount,
          allCount - successfulCount - abandonCount,
        ]),
      );
    } else if (successfulCount > 0) {
      message.success(t(p("moveCopy.successMessage"), [operationText, allCount, successfulCount, abandonCount]));
    }

    resetSelectedAndOperation();
    reload();
  };

  const onDownloadClick = () => {
    const files = keysToFiles(selectedKeys);
    window.open(
      urlToCompressAndDownload(
        currentClusterRef.current.id,
        files.map((x) => join(path, x.name)),
        true,
      ),
      "_blank",
    );
  };

  const onDeleteClick = () => {
    const files = keysToFiles(selectedKeys);
    modal.confirm({
      title: t(p("delete.confirmTitle")),
      okText: t(p("delete.confirmOk")),
      content: t(p("delete.confirmContent"), [files.length]),
      onOk: async () => {
        await Promise.allSettled(
          files.map(async (x) => {
            return (x.type === "FILE" ? api.deleteFile : api.deleteDir)({
              query: {
                cluster: currentClusterRef.current.id,
                path: join(path, x.name),
              },
            })
              .then(() => x)
              .catch(() => undefined);
          }),
        )
          .then((successfulInfo) => {
            const failedCount = successfulInfo.filter(
              (x: PromiseSettledResult) => !x || x.status === "rejected" || !x.value,
            ).length;
            const allCount = files.length;
            if (failedCount === 0) {
              message.success(t(p("delete.successMessage"), [allCount]));
              resetSelectedAndOperation();
            } else {
              message.error(t(p("delete.errorMessage"), [allCount - failedCount, failedCount]));
              setOperation((o) => o && { ...o, started: false });
            }
          })
          .catch((e) => {
            console.log(e);
            message.error(t(p("delete.otherErrorMessage")));
            setOperation((o) => o && { ...o, started: false });
            setSelectedKeys([]);
          })
          .finally(() => {
            setOperation(undefined);
            reload();
          });
      },
    });
  };

  const keysToFiles = (keys: React.Key[]) => {
    return files.filter((x) => keys.includes(fileInfoKey(x, path)));
  };

  const onHiddenClick = () => {
    setShowHiddenFile(!showHiddenFile);
  };

  const handlePreview = (filename: string, fileSize: number) => {
    const filePreviewLimitSize = publicConfig.FILE_PREVIEW_SIZE || DEFAULT_FILE_PREVIEW_LIMIT_SIZE;
    if (fileSize > convertToBytes(filePreviewLimitSize)) {
      message.info(t(p("preview.fileTooLarge"), [filePreviewLimitSize]));
      return;
    }

    if (isImage(filename)) {
      setPreviewImage({
        ...previewImage,
        visible: true,
        src: urlToDownload(currentClusterRef.current.id, join(path, filename), false),
      });
      return;
    } else if (!isNonEditableFilename(filename, publicConfig.NON_EDITABLE_FILENAME_POSTFIXES)) {
      setPreviewFile({
        open: true,
        filename,
        fileSize: fileSize,
        filePath: join(path, filename),
        clusterId: currentClusterRef.current.id,
      });
      return;
    } else {
      message.info(t(p("preview.unsupportedFileType")));
      return;
    }
  };

  const submitFile = (fileName: string, filePathOverride?: string, clusterIdOverride?: string) => {
    const targetClusterId = clusterIdOverride ?? currentClusterRef.current.id;
    const fullPath = filePathOverride ?? join(path, fileName);
    const targetCluster = currentClusters.find((c) => c.id === targetClusterId) || currentClusterRef.current;
    setSubmitConfirmInfo({
      fileName,
      fullPath,
      targetClusterId,
      targetClusterName: getI18nConfigCurrentText(targetCluster.name, languageId),
    });
  };

  const handleSubmitConfirmOk = async () => {
    if (!submitConfirmInfo) return;
    const { targetClusterId, fullPath } = submitConfirmInfo;
    setSubmitLoading(true);
    try {
      await api
        .submitFileAsJob({
          body: { cluster: targetClusterId, filePath: fullPath },
        })
        .httpError(500, (e) => {
          if (e.code === "SCHEDULER_FAILED" || e.code === "FAILED_PRECONDITION" || e.code === "UNIMPLEMENTED") {
            setSubmitConfirmInfo(null);
            modal.error({
              title: t(p("tableInfo.submitFailedMessage")),
              content: e.message,
            });
          } else {
            message.error(e.message);
            throw e;
          }
        })
        .httpError(400, (e) => {
          if (e.code === "INVALID_ARGUMENT" || e.code === "INVALID_PATH") {
            setSubmitConfirmInfo(null);
            modal.error({
              title: t(p("tableInfo.submitFailedMessage")),
              content: e.message,
            });
          } else {
            message.error(e.message);
            throw e;
          }
        })
        .then((result) => {
          setSubmitConfirmInfo(null);
          setSubmitSuccessJobId(result.jobId);
          resetSelectedAndOperation();
          reload();
        });
    } finally {
      setSubmitLoading(false);
    }
  };

  // 递归解析符号链接的最终目标
  const resolveSymlinkTargetRecursively = async (
    startPath: string,
  ): Promise<{ finalPath: string; finalType: "FILE" | "DIR" }> => {
    let currentPath = startPath;
    // 防止无限循环，最多解析 20 层
    for (let i = 0; i < 20; i++) {
      const meta = await api.getFileMetadata({
        query: { cluster: currentClusterRef.current.id, path: currentPath },
      });

      const typeUpper = (meta.type ?? "").toUpperCase();
      const isSymlink = !!meta.isSymlink || typeUpper === "SYMLINK";

      if (isSymlink && meta.linkTargetPath) {
        currentPath = meta.linkTargetPath;
        continue;
      }

      if (typeUpper === "FILE") {
        return { finalPath: currentPath, finalType: "FILE" };
      }
      if (typeUpper === "DIR") {
        return { finalPath: currentPath, finalType: "DIR" };
      }

      // 如果后端返回的 linkTargetType 有值，作为兜底
      const targetTypeUpper = (meta.linkTargetType ?? "").toUpperCase();
      if (targetTypeUpper === "FILE" || targetTypeUpper === "DIR") {
        return { finalPath: currentPath, finalType: targetTypeUpper };
      }

      throw new Error("Unable to resolve target of symbolic link");
    }

    throw new Error("Symbolic links are nested too deeply");
  };

  // 根据解析出的最终目标进行跳转或预览
  const navigateResolvedSymlinkTarget = async (initialTargetPath: string) => {
    setLoading(true);
    try {
      const { finalPath, finalType } = await resolveSymlinkTargetRecursively(initialTargetPath);
      if (finalType === "FILE") {
        const destDir = dirname(finalPath);
        const fileName = basename(finalPath);
        router.push(`${fullUrl(destDir)}?edit=${encodeURIComponent(fileName)}`);
      } else {
        router.push(fullUrl(finalPath));
      }
    } catch (e) {
      message.error(`${t(p("failedResolveSymlink"))}${e?.message ? ": " + e.message : ""}`);
    } finally {
      setLoading(false);
    }
  };

  const editFile = queryToString(router.query.edit);

  useEffect(() => {
    if (editFile !== "") {
      const foundFile = files.find((file) => file.name === editFile);
      if (foundFile && foundFile.type !== "DIR") {
        handlePreview(editFile, foundFile.size);
      }
    }
  }, [editFile, files]);

  // 关闭文件预览时，移除 URL 中的 edit 查询参数，避免再次点击同一文件时不触发预览
  useEffect(() => {
    if (!previewFile.open && !previewImage.visible && router.query.edit) {
      router.replace(fullUrl(path), undefined, { shallow: true });
    }
  }, [previewFile.open, previewImage.visible]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadDirModalOpen, setIsUploadDirModalOpen] = useState(false);

  useEffect(() => {
    const uploadQuery = queryToString(router.query.uploadModalOpen);
    if (uploadQuery === "true") {
      setIsUploadModalOpen(true);
    } else {
      setIsUploadModalOpen(false);
    }
  }, []);

  const handleUploadModalClose = () => {
    setIsUploadModalOpen(false);
  };

  const handleUploadDirModalClose = () => {
    setIsUploadDirModalOpen(false);
  };

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    if ((e.key as UploadType) === UploadType.File) {
      setIsUploadModalOpen(true);
    } else {
      setIsUploadDirModalOpen(true);
    }
  };

  const items: MenuProps["items"] = [
    {
      label: t(p("uploadMenuFile")),
      key: UploadType.File,
    },
    {
      label: t(p("uploadMenuDir")),
      key: UploadType.Dir,
    },
  ];

  const menuProps = {
    items,
    onClick: handleMenuClick,
  };

  const newItems: MenuProps["items"] = [
    {
      label: (
        <CreateFileButton cluster={currentClusterRef.current.id} path={path} reload={reload}>
          {t(p("tableInfo.newMenuFile"))}
        </CreateFileButton>
      ),
      key: UploadType.File,
    },
    {
      label: (
        <MkdirButton cluster={currentClusterRef.current.id} path={path} reload={reload}>
          {t(p("tableInfo.newMenuDir"))}
        </MkdirButton>
      ),
      key: UploadType.Dir,
    },
  ];

  const newMenuProps = {
    items: newItems,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: `calc(100vh - ${FILE_MANAGER_TOP_OFFSET_PX}px)`,
        overflow: "hidden",
      }}
    >
      <TitleText>
        <span>{t(p("tableInfo.title"))}</span>
      </TitleText>
      <TopCard>
        <TopBar>
          <SelectPreFix>{`${t(p("cluster"))} :`}</SelectPreFix>
          <Select
            style={{ minWidth: "160px", height: "36px" }}
            onSelect={(value) => {
              const previousClusterId = currentClusterRef.current.id;
              const newCluster = currentClusters.find((x) => x.id === value) || { id: value, name: "" };
              currentClusterRef.current = newCluster;
              // 集群ID被切换时，确保返回家目录
              if (previousClusterId !== value) {
                // 重置已复制项和操作
                resetSelectedAndOperation();
                toHome(value);
              }
            }}
            defaultValue={currentClusterRef.current.id}
            options={currentClusters.map((cluster) => ({
              label: getI18nConfigCurrentText(cluster.name, languageId),
              value: cluster.id,
            }))}
          />
          <UpButtonBox onClick={up}>
            <ForwardIcon />
          </UpButtonBox>
          <PathBar
            compact
            path={path}
            loading={loading}
            onPathChange={(curPath) => {
              if (curPath === path) {
                reload();
              } else {
                router.push(fullUrl(curPath));
              }
            }}
            breadcrumbItemRender={(pathSegment, index, path) =>
              index === 0 ? null : (
                <Link href={fullUrl(path)} key={index} onClick={(e) => e.stopPropagation()}>
                  {pathSegment}
                </Link>
              )
            }
          />
          {publicConfig.ENABLE_SHELL ? (
            <Link
              href={`/shell/${currentClusterRef.current.id}/${loginNode}${path}`}
              target="_blank"
              style={{ marginLeft: 5 }}
            >
              <Button icon={<OpenInShellIcon />} $color={theme.palette.gray[8]}>
                {t(p("tableInfo.openInShell"))}
              </Button>
            </Link>
          ) : null}
        </TopBar>
        <OperationBar>
          <Space wrap>
            <Dropdown menu={newMenuProps}>
              <Button icon={<CreateIcon />} $color={theme.palette.gray[8]}>
                <Space>
                  {t(p("tableInfo.new"))}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
            <Dropdown menu={menuProps}>
              <Button icon={<UploadIcon />} $color={theme.palette.gray[8]}>
                <Space>
                  {t(p("upload"))}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
            <Button
              icon={<CopyIcon disabled={selectedKeys.length === 0 || !!operation?.started} />}
              onClick={() =>
                setOperation({
                  op: "copy",
                  selected: keysToFiles(selectedKeys),
                  originalPath: path,
                  started: false,
                  completed: [],
                })
              }
              disabled={selectedKeys.length === 0 || operation?.started}
              $color={theme.palette.gray[8]}
            >
              {t(p("tableInfo.copySelected"))}
            </Button>
            <Button
              icon={<MoveIcon disabled={selectedKeys.length === 0 || !!operation?.started} />}
              onClick={() =>
                setOperation({
                  op: "move",
                  selected: keysToFiles(selectedKeys),
                  originalPath: path,
                  started: false,
                  completed: [],
                })
              }
              disabled={selectedKeys.length === 0 || operation?.started}
              $color={theme.palette.gray[8]}
            >
              {t(p("tableInfo.moveSelected"))}
            </Button>
            <Button
              icon={<PasteIcon disabled={!operation || operation.started || operation.originalPath === path} />}
              onClick={paste}
              disabled={!operation || operation.started || operation.originalPath === path}
              $color={theme.palette.gray[8]}
            >
              {t(p("tableInfo.paste"))}
            </Button>
            <CompressFilesButton
              cluster={currentClusterRef.current.id}
              path={path}
              files={keysToFiles(selectedKeys)}
              reload={reload}
              setCompression={setCompression}
            >
              {t(p("compressSelected"))}
            </CompressFilesButton>
            <Tooltip title={getDecompressButtonDisabledReason()}>
              <span>
                <DecompressFilesButton
                  cluster={currentClusterRef.current.id}
                  sourcePath={path}
                  files={keysToFiles(selectedKeys)}
                  reload={reload}
                  setDecompression={setDecompression}
                >
                  {t(p("decompressionSelected"))}
                </DecompressFilesButton>
              </span>
            </Tooltip>
            <Button
              icon={<FileDownloadIcon disabled={selectedKeys.length === 0} />}
              onClick={onDownloadClick}
              disabled={selectedKeys.length === 0}
              $color={theme.palette.gray[8]}
            >
              {t(p("tableInfo.downloadSelected"))}
            </Button>
            <Button
              icon={<FileDeleteIcon disabled={selectedKeys.length === 0 || !!operation?.started} />}
              onClick={onDeleteClick}
              disabled={selectedKeys.length === 0 || operation?.started}
              $color={theme.palette.gray[8]}
            >
              {t(p("tableInfo.deleteSelected"))}
            </Button>
            {operation ? (
              operation.started ? (
                <span>
                  {t(p("tableInfo.operationStarted"), [operationTexts[operation.op]])} +
                  {`${operation.completed.length} / ${operation.selected.length}`}
                </span>
              ) : (
                <span>
                  {t(p("tableInfo.operationNotStarted"), [operationTexts[operation.op], operation.selected.length])}
                  <a onClick={() => setOperation(undefined)} style={{ marginLeft: "4px" }}>
                    {t("button.cancelButton")}
                  </a>
                </span>
              )
            ) : (
              ""
            )}
            {compression.started.length - compression.completed.length > 0 && (
              <div>
                <span style={{ color: theme.token.colorPrimary }}>
                  {t(p("compressionInProgress"))}
                  {`${compression.completed.length} / ${compression.started.length}`}
                </span>
              </div>
            )}
            {decompression.decompressionStarted.length - decompression.decompressionCompleted.length > 0 && (
              <div>
                <span style={{ color: theme.token.colorPrimary }}>
                  {t(p("decompressionInProgress"))}
                  {`${decompression.decompressionCompleted.length} / ${decompression.decompressionStarted.length}`}
                </span>
              </div>
            )}
          </Space>
          <Space wrap>
            <span>{`${t(p("tableInfo.showHiddenFiles"))}`}</span>
            <Switch checked={showHiddenFile} onChange={onHiddenClick}></Switch>
          </Space>
        </OperationBar>
      </TopCard>

      <FileBrowserLayout
        style={{ flex: 1, minHeight: 0 }}
        entries={[
          {
            key: "home",
            label: t(p("homeDirectory")),
            icon: <HomeDirIcon disabled={selectedEntryIndex !== "home"} />,
            selected: selectedEntryIndex === "home",
            onClick: () => {
              toHome(currentClusterRef.current.id);
            },
          },
          ...enrichedEntryPaths.map((entry, index) => ({
            key: index,
            label: getI18nConfigCurrentText(entry.displayName, languageId),
            icon: <EntryPathIcon disabled={selectedEntryIndex !== index} />,
            selected: selectedEntryIndex === index,
            onClick: () => {
              router.push(fullUrl(entry.resolvedPath.replace(/\/+/g, "/")));
            },
          })),
        ]}
        sidebarBottom={
          <>
            <Divider style={{ margin: "8px 0" }} />
            {showQuotaInfo && selectedStorageInfo && (
              <StorageInfoSection>
                <div style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
                  <StorageIcon />
                  {getI18nConfigCurrentText(selectedStorageInfo.config.displayName, languageId)}
                </div>
                {selectedStorageInfo.info.accountQuotaMb !== undefined ? (
                  <>
                    <ProgressRow>
                      <Progress
                        percent={
                          selectedStorageInfo.info.quotaMb > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (Number(selectedStorageInfo.info.usedStorageMb) /
                                    Number(selectedStorageInfo.info.quotaMb)) *
                                    100,
                                ),
                              )
                            : 0
                        }
                        size="small"
                        status={
                          selectedStorageInfo.info.quotaMb > 0 &&
                          selectedStorageInfo.info.usedStorageMb >= selectedStorageInfo.info.quotaMb
                            ? "exception"
                            : "normal"
                        }
                        showInfo={false}
                        style={{ flex: 1, marginBottom: 0 }}
                      />
                      <ProgressPercentage>
                        {selectedStorageInfo.info.quotaMb > 0
                          ? `${Math.min(100, Math.round((Number(selectedStorageInfo.info.usedStorageMb) / Number(selectedStorageInfo.info.quotaMb)) * 100))}%`
                          : "0%"}
                      </ProgressPercentage>
                    </ProgressRow>
                    <StorageUsageText $marginBottom={6}>
                      {t(p("userStorageQuota"))}
                      {": "}
                      {`${formatMBToGB(selectedStorageInfo.info.usedStorageMb).toFixed(2)} GB`}
                      {" / "}
                      {`${formatMBToGB(selectedStorageInfo.info.quotaMb).toFixed(2)} GB`}
                      {selectedStorageInfo.config.replicaExist && (
                        <Tooltip title={t(p("storageQuotaTooltip"))}>
                          <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                        </Tooltip>
                      )}
                    </StorageUsageText>
                    <ProgressRow>
                      <Progress
                        percent={
                          selectedStorageInfo.info.accountQuotaMb > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (Number(selectedStorageInfo.info.accountUsedStorageMb ?? 0) /
                                    Number(selectedStorageInfo.info.accountQuotaMb)) *
                                    100,
                                ),
                              )
                            : 0
                        }
                        size="small"
                        status={
                          selectedStorageInfo.info.accountQuotaMb > 0 &&
                          (selectedStorageInfo.info.accountUsedStorageMb ?? 0) >=
                            selectedStorageInfo.info.accountQuotaMb
                            ? "exception"
                            : "normal"
                        }
                        showInfo={false}
                        style={{ flex: 1, marginBottom: 0 }}
                      />
                      <ProgressPercentage>
                        {selectedStorageInfo.info.accountQuotaMb > 0
                          ? `${Math.min(100, Math.round((Number(selectedStorageInfo.info.accountUsedStorageMb ?? 0) / Number(selectedStorageInfo.info.accountQuotaMb)) * 100))}%`
                          : "0%"}
                      </ProgressPercentage>
                    </ProgressRow>
                    <StorageUsageText>
                      {t(p("accountStorageQuota"))}
                      {": "}
                      {`${formatMBToGB(selectedStorageInfo.info.accountUsedStorageMb ?? 0).toFixed(2)} GB`}
                      {" / "}
                      {`${formatMBToGB(selectedStorageInfo.info.accountQuotaMb).toFixed(2)} GB`}
                      <Tooltip title={t(p("accountStorageQuotaTooltip"))}>
                        <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </StorageUsageText>
                  </>
                ) : (
                  <>
                    <ProgressRow>
                      <Progress
                        percent={
                          selectedStorageInfo.info.quotaMb > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (Number(selectedStorageInfo.info.usedStorageMb) /
                                    Number(selectedStorageInfo.info.quotaMb)) *
                                    100,
                                ),
                              )
                            : 0
                        }
                        size="small"
                        status={
                          selectedStorageInfo.info.quotaMb > 0 &&
                          selectedStorageInfo.info.usedStorageMb >= selectedStorageInfo.info.quotaMb
                            ? "exception"
                            : "normal"
                        }
                        showInfo={false}
                        style={{ flex: 1, marginBottom: 0 }}
                      />
                      <ProgressPercentage>
                        {selectedStorageInfo.info.quotaMb > 0
                          ? `${Math.min(100, Math.round((Number(selectedStorageInfo.info.usedStorageMb) / Number(selectedStorageInfo.info.quotaMb)) * 100))}%`
                          : "0%"}
                      </ProgressPercentage>
                    </ProgressRow>
                    <div>
                      {`${formatMBToGB(selectedStorageInfo.info.usedStorageMb).toFixed(2)} GB`}
                      {" / "}
                      {`${formatMBToGB(selectedStorageInfo.info.quotaMb).toFixed(2)} GB`}
                      {selectedStorageInfo.config.replicaExist && (
                        <Tooltip title={t(p("storageQuotaTooltip"))}>
                          <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                        </Tooltip>
                      )}
                    </div>
                  </>
                )}
              </StorageInfoSection>
            )}
          </>
        }
        collapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed((c) => !c)}
      >
        {/* 文件列表区域 */}
        <FileTableWrapper $fillHeight $inFileManager>
          <FileTable
            files={files}
            filesFilter={(files) => files.filter((file) => showHiddenFile || !file.name.startsWith("."))}
            loading={loading}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
            }}
            rowKey={(r) => fileInfoKey(r, path)}
            onRow={(r) => ({
              onClick: () => {
                setSelectedKeys([fileInfoKey(r, path)]);
              },
              onDoubleClick: () => {
                if (!loading && r.type === "DIR") {
                  setLoading(true);
                  router.push(fullUrl(join(path, r.name)));
                } else if (r.type === "FILE") {
                  handlePreview(r.name, r.size);
                } else if (r.type === "SYMLINK") {
                  const targetPath = r.linkTargetPath;
                  if (targetPath) {
                    navigateResolvedSymlinkTarget(targetPath);
                  }
                }
              },
            })}
            fileNameRender={(_, r) =>
              r.type === "DIR" ? (
                <a
                  onClick={() => {
                    if (!loading) {
                      setLoading(true);
                      router.push(fullUrl(join(path, r.name)));
                    }
                  }}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {r.name}
                </a>
              ) : r.type === "SYMLINK" ? (
                <Tooltip
                  title={
                    <div>
                      {t(p("tableInfo.symlinkTooltip.type"))}
                      <br />
                      <div>{t(p("tableInfo.symlinkTooltip.targetPathPrefix"))}</div>
                      {r.linkTargetPath ?? ""}
                    </div>
                  }
                >
                  <a
                    onClick={() => {
                      const targetPath = r.linkTargetPath;
                      if (targetPath) {
                        navigateResolvedSymlinkTarget(targetPath);
                      }
                    }}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {r.name}
                  </a>
                </Tooltip>
              ) : (
                <a
                  onClick={() => {
                    handlePreview(r.name, r.size);
                  }}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {r.name}
                </a>
              )
            }
            actionRender={(_, i: FileInfo) => (
              <Space size={8}>
                {i.type === "FILE" && (
                  <Tooltip title={t(p("tableInfo.download"))}>
                    <a href={urlToDownload(currentClusterRef.current.id, join(path, i.name), true)}>
                      <DownloadIcon />
                    </a>
                  </Tooltip>
                )}
                {i.type === "DIR" && (
                  <a href={urlToCompressAndDownload(currentClusterRef.current.id, [join(path, i.name)], true)}>
                    <DownloadIcon />
                  </a>
                )}
                {
                  <RenameLink
                    cluster={currentClusterRef.current.id}
                    path={join(path, i.name)}
                    reload={reload}
                    isFile={i.type !== "DIR"}
                  >
                    <Tooltip title={t(p("tableInfo.rename"))}>
                      <RenameIcon />
                    </Tooltip>
                  </RenameLink>
                }
                {i.type === "FILE" && isExecutableScriptFilename(i.name, publicConfig.EXECUTABLE_FILENAME_POSTFIXES) ? (
                  <Tooltip title={t(p("submitJob"))}>
                    <SubmitIcon
                      onClick={() => {
                        submitFile(i.name);
                      }}
                    />
                  </Tooltip>
                ) : undefined}
                <Tooltip title={t("button.deleteButton")}>
                  <DeleteIcon
                    onClick={() => {
                      const fullPath = join(path, i.name);
                      modal.confirm({
                        title: t(p("tableInfo.deleteConfirmTitle")),
                        // icon: < />,
                        content: t(p("tableInfo.deleteConfirmContent"), [fullPath]),
                        okText: t(p("tableInfo.deleteConfirmOk")),
                        onOk: async () => {
                          await (i.type === "DIR" ? api.deleteDir : api.deleteFile)({
                            query: {
                              cluster: currentClusterRef.current.id,
                              path: fullPath,
                            },
                          })
                            .httpError(403, (e) => {
                              if (e.code === "FORBIDDEN") {
                                message.error(`${t(p("noAccessPermission"))}: ${e.error}`);
                                throw e;
                              } else {
                                message.error(e.error);
                                throw e;
                              }
                            })
                            .then(() => {
                              message.success(t(p("tableInfo.deleteSuccessMessage")));
                              resetSelectedAndOperation();
                              reload();
                            });
                        },
                      });
                    }}
                  />
                </Tooltip>
              </Space>
            )}
          />
        </FileTableWrapper>
      </FileBrowserLayout>
      <ImagePreviewer previewImage={previewImage} setPreviewImage={setPreviewImage} />
      <FileEditModal
        previewFile={previewFile}
        setPreviewFile={setPreviewFile}
        storageInfo={storageInfos?.find((i) => i.storageId === selectedStorageConfig?.storageId)}
        canSubmitFile={
          previewFile.open &&
          isExecutableScriptFilename(previewFile.filename, publicConfig.EXECUTABLE_FILENAME_POSTFIXES)
        }
        onSubmitFile={() => submitFile(previewFile.filename, previewFile.filePath, previewFile.clusterId)}
      />
      <UploadModal
        open={isUploadModalOpen}
        onClose={handleUploadModalClose}
        cluster={currentClusterRef.current.id}
        path={path}
        reload={reload}
      />
      <UploadDirModal
        open={isUploadDirModalOpen}
        onClose={handleUploadDirModalClose}
        cluster={currentClusterRef.current.id}
        path={path}
        reload={reload}
      />
      <StyledModal
        open={submitConfirmInfo !== null}
        title={
          <span>
            <ExclamationCircleFilled style={{ color: theme.token.colorWarning, marginRight: 8 }} />
            {t(p("tableInfo.submitConfirmTitle"))}
          </span>
        }
        okText={t(p("tableInfo.submitConfirmOk"))}
        onOk={handleSubmitConfirmOk}
        confirmLoading={submitLoading}
        onCancel={() => setSubmitConfirmInfo(null)}
        maskClosable={false}
      >
        <p>{t(p("tableInfo.submitConfirmNotice"))}</p>
        <p>
          {t(p("tableInfo.submitConfirmContent"), [submitConfirmInfo?.fileName, submitConfirmInfo?.targetClusterName])}
        </p>
      </StyledModal>
      <StyledModal
        open={submitSuccessJobId !== null}
        title={
          <span>
            <CheckCircleFilled style={{ color: "green", marginRight: 8 }} />
            {t(p("submitSuccessTitle"))}
          </span>
        }
        onOk={() => {
          setSubmitSuccessJobId(null);
          router.push("/jobs/allJobs");
        }}
        onCancel={() => setSubmitSuccessJobId(null)}
        maskClosable={false}
        okText={t(p("viewJobList"))}
        cancelText={t("button.confirmButton")}
      >
        <span>
          {t(p("submitSuccessJobIdLabel"))}
          <span style={{ color: theme.token.colorPrimary }}>{submitSuccessJobId}</span>
        </span>
      </StyledModal>
    </div>
  );
};

const RenameLink = ModalLink(RenameModal);
const CreateFileButton = ModalLink(CreateFileModal);
const MkdirButton = ModalLink(MkdirModal);
