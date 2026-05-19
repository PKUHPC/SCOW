import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  CompressOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  ExpandOutlined,
  FileAddOutlined,
  HomeOutlined,
  MacCommandOutlined,
  QuestionCircleOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  UploadOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { formatBytesToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { isExecutableScriptFilename, isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Divider, Dropdown, MenuProps, Select, Space, Switch, Tooltip } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import { basename, dirname, join } from "path";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis/api";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { DeleteIcon, DownloadIcon, RenameIcon, SubmitIcon } from "src/icons/operationIcon";
import { urlToCompressAndDownload, urlToDownload } from "src/pageComponents/filemanager/api";
import { CompressFilesModal } from "src/pageComponents/filemanager/CompressFilesModal";
import { CreateFileModal } from "src/pageComponents/filemanager/CreateFileModal";
import { FileEditModal } from "src/pageComponents/filemanager/FileEditModal";
import { FileTable } from "src/pageComponents/filemanager/FileTable";
import { ImagePreviewer } from "src/pageComponents/filemanager/ImagePreviewer";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { PathBar } from "src/pageComponents/filemanager/PathBar";
import { RenameModal } from "src/pageComponents/filemanager/RenameModal";
import { UploadDirModal } from "src/pageComponents/filemanager/UploadDirModal";
import { UploadModal } from "src/pageComponents/filemanager/UploadModal";
import { FileInfo } from "src/pages/api/file/list";
import { isDecompressibleFile } from "src/server/file";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { convertToBytes } from "src/utils/format";
import { styled, useTheme } from "styled-components";

import { DecompressFilesModal } from "./DecompressFilesModal";

interface Props {
  initialCluster: Cluster;
  path: string;
  urlPrefix: string;
  scowdEnabledClusters: string[];
}

interface PromiseSettledResult {
  status: string;
  value?: FileInfo | undefined;
}

interface HomePathInfo {
  clusterId: string;
  homePath: string;
}

const SelectPreFix = styled.span`
  width: 65px;
  display: flex;
  align-items: center;
  white-space: nowrap;
`;

const TopBar = styled(FilterFormContainer)`
  display: flex;
  flex-direction: row;
  padding-bottom: 8px;
  width: 100%;
  align-items: center;

  & > button {
    margin: 0px 4px;
  }
`;

const OperationBar = styled(TableTitle)`
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
`;

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

export const FileManager: React.FC<Props> = ({ initialCluster, path, urlPrefix, scowdEnabledClusters }) => {
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
  const [scowdEnabled, setScowdEnabled] = useState<boolean>(
    !!scowdEnabledClusters?.includes(currentClusterRef.current.id),
  );

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

  const { loginNodes } = useStore(LoginNodeStore);
  const { storageEnabled, fullClusterConfigs } = useStore(ClusterInfoStore);
  const loginNode = loginNodes[currentClusterRef.current.id][0].address;

  const promiseFn = useCallback(async () => {
    if (!storageEnabled || !fullClusterConfigs[currentClusterRef.current.id].storage?.enabled) return undefined;
    const { storageInfos } = await api.getUserStorageInfo({
      query: {
        cluster: currentClusterRef.current.id,
      },
    });
    return storageInfos;
  }, [storageEnabled, currentClusterRef.current.id]);

  const { data: storageInfos } = useAsync({ promiseFn, watch: currentClusterRef.current.id });

  const CompressFilesButton = ModalButton(CompressFilesModal, {
    icon: <CompressOutlined />,
    disabled: selectedKeys.length === 0,
  });

  const DecompressFilesButton = ModalButton(DecompressFilesModal, {
    icon: <ExpandOutlined />,
    // 仅在scowd开启时支持此功能
    disabled:
      selectedKeys.length === 0 || selectedKeys.some((sKey) => !isDecompressibleFile(sKey.toString())) || !scowdEnabled,
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
          await new Promise<void>((res) => {
            modal.confirm({
              title: t(p("moveCopy.existModalTitle")),
              content: t(p("moveCopy.existModalContent"), [x.name]),
              okText: t(p("moveCopy.existModalOk")),
              onOk: async () => {
                const fileType = await api.getFileType({
                  query: { cluster: currentClusterRef.current.id, path: join(path, x.name) },
                });
                const deleteOperation = fileType.type === "dir" ? api.deleteDir : api.deleteFile;
                await deleteOperation({
                  query: { cluster: currentClusterRef.current.id, path: join(path, x.name) },
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
    } else {
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
      label: t(p("uploadFile")),
      key: UploadType.File,
    },
    {
      label: t(p("uploadDir")),
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
          {t(p("tableInfo.createFile"))}
        </CreateFileButton>
      ),
      key: UploadType.File,
    },
    {
      label: (
        <MkdirButton cluster={currentClusterRef.current.id} path={path} reload={reload}>
          {t(p("tableInfo.mkDir"))}
        </MkdirButton>
      ),
      key: UploadType.Dir,
    },
  ];

  const newMenuProps = {
    items: newItems,
  };

  return (
    <div>
      <TitleText>
        <span>{t(p("tableInfo.title"))}</span>
      </TitleText>
      <TopBar>
        <SelectPreFix>{`${t(p("cluster"))} :`}</SelectPreFix>
        <Select
          style={{ minWidth: "160px" }}
          onSelect={(value) => {
            const previousClusterId = currentClusterRef.current.id;
            const newCluster = currentClusters.find((x) => x.id === value) || { id: value, name: "" };
            currentClusterRef.current = newCluster;
            setScowdEnabled(!!scowdEnabledClusters?.includes(value));

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
        <Button onClick={() => toHome(currentClusterRef.current.id)} icon={<HomeOutlined />} shape="circle" />
        <Button onClick={up} icon={<UpOutlined />} shape="circle" />
        <PathBar
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
            index === 0 ? (
              <DatabaseOutlined />
            ) : (
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
            <Button icon={<MacCommandOutlined />}>{t(p("tableInfo.openInShell"))}</Button>
          </Link>
        ) : null}
      </TopBar>
      <OperationBar>
        <Space wrap>
          <Dropdown menu={newMenuProps}>
            <Button icon={<FileAddOutlined />}>
              <Space>
                {t(p("tableInfo.new"))}
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>
          {scowdEnabled ? (
            <Dropdown menu={menuProps}>
              <Button icon={<UploadOutlined />}>
                <Space>
                  {t(p("upload"))}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          ) : (
            <UploadButton
              externalOpen={isUploadModalOpen}
              cluster={currentClusterRef.current.id}
              path={path}
              reload={reload}
              scowdEnabled={scowdEnabled}
            >
              {t(p("tableInfo.uploadButton"))}
            </UploadButton>
          )}
          <Button
            icon={<CopyOutlined />}
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
          >
            {t(p("tableInfo.copySelected"))}
          </Button>
          <Button
            icon={<ScissorOutlined />}
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
          >
            {t(p("tableInfo.moveSelected"))}
          </Button>
          <Button
            icon={<SnippetsOutlined />}
            onClick={paste}
            disabled={!operation || operation.started || operation.originalPath === path}
          >
            {t(p("tableInfo.paste"))}
          </Button>
          {scowdEnabled && (
            <CompressFilesButton
              cluster={currentClusterRef.current.id}
              path={path}
              files={keysToFiles(selectedKeys)}
              reload={reload}
              setCompression={setCompression}
            >
              {t(p("compressSelected"))}
            </CompressFilesButton>
          )}

          {/* 解压缩 */}
          {/* 仅在 scowd 开启时支持文件管理下的此功能 */}
          {scowdEnabled && (
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
          )}
          {scowdEnabled && (
            <Button icon={<DownloadOutlined />} onClick={onDownloadClick} disabled={selectedKeys.length === 0}>
              {t(p("tableInfo.downloadSelected"))}
            </Button>
          )}
          <Button
            icon={<DeleteOutlined />}
            onClick={onDeleteClick}
            disabled={selectedKeys.length === 0 || operation?.started}
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

      <TableTitle justify="space-between">
        {storageInfos ? (
          <div>
            <span>
              <Space>
                {`${t(p("storageQuota"))}(${fullClusterConfigs[currentClusterRef.current.id].storage?.paths[0]})`}
                <span>{formatBytesToGB(storageInfos[0].quotaBytes).toFixed(2) + " GB"}</span>
              </Space>
            </span>
            <Divider type="vertical" />
            <span>
              <Space>
                {t(p("usage"))}
                <span>{formatBytesToGB(storageInfos[0].usedStorageBytes).toFixed(2) + " GB"}</span>
                {fullClusterConfigs[currentClusterRef.current.id].storage?.replicaExist && (
                  <Tooltip title={t(p("storageQuotaTooltip"))}>
                    <QuestionCircleOutlined />
                  </Tooltip>
                )}
              </Space>
            </span>
          </div>
        ) : undefined}
      </TableTitle>
      <FileTable
        files={files}
        filesFilter={(files) => files.filter((file) => showHiddenFile || !file.name.startsWith("."))}
        loading={loading}
        scroll={{ x: true }}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
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
            {i.type === "DIR" && scowdEnabled && (
              <a href={urlToCompressAndDownload(currentClusterRef.current.id, [join(path, i.name)], true)}>
                <DownloadIcon />
              </a>
            )}
            {
              <RenameLink cluster={currentClusterRef.current.id} path={join(path, i.name)} reload={reload}>
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
                      }).then(() => {
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
      <ImagePreviewer previewImage={previewImage} setPreviewImage={setPreviewImage} />
      <FileEditModal
        previewFile={previewFile}
        setPreviewFile={setPreviewFile}
        storageInfo={storageInfos?.[0]}
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
        scowdEnabled={scowdEnabled}
      />
      <UploadDirModal
        open={isUploadDirModalOpen}
        onClose={handleUploadDirModalClose}
        cluster={currentClusterRef.current.id}
        path={path}
        reload={reload}
        scowdEnabled={scowdEnabled}
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
          router.push("/jobs/runningJobs");
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
const UploadButton = ModalButton(UploadModal, { icon: <UploadOutlined /> });
