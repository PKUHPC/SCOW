import type { inferRouterOutputs } from "@trpc/server";

import { DownOutlined } from "@ant-design/icons";
import { FileBrowserLayout } from "@scow/lib-web/build/components/filemanager/FileBrowserLayout";
import {
  FILE_MANAGER_TOP_OFFSET_PX,
  TopCard,
  SelectPreFix,
  UpButtonBox,
  TopBar,
  OperationBar,
} from "@scow/lib-web/build/components/filemanager/FileManagerLayout";
import { FileTableWrapper } from "@scow/lib-web/build/components/filemanager/FileTableWrapper";
import { PathBar } from "@scow/lib-web/build/components/filemanager/PathBar";
import { RoundedButton as Button } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { RoundedModalButton } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { useAutoSelectSidebar } from "@scow/lib-web/build/hooks/useAutoSelectSidebar";
import {
  CompressIcon,
  CopyIcon,
  CreateIcon,
  DecompressIcon,
  DeleteIcon as FileDeleteIcon,
  EntryPathIcon,
  ForwardIcon,
  MoveIcon,
  PasteIcon,
  UploadIcon,
  HomeDirIcon,
} from "@scow/lib-web/build/icons/FileIcon";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import { buildEnrichedEntryPaths } from "@scow/lib-web/build/utils/storageClusterHelper";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Dropdown, MenuProps, Space, Switch, Tooltip } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { basename, dirname, join } from "path";
import React, { useEffect, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useFileManager } from "src/app/(auth)/files/context";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { CompressionModal } from "src/components/CompressionModal";
import { DecompressionModal } from "src/components/DecompressionModal";
import { FileEditModal } from "src/components/FileEditModal";
import { FileTable } from "src/components/FileTable";
import { ImagePreviewer } from "src/components/ImagePreviewer";
import { MkdirModal } from "src/components/MkdirModal";
import { ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { UploadDirModal } from "src/components/UploadDirModal";
import { UploadModal } from "src/components/UploadModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { DeleteIcon, DownloadIcon, RenameIcon } from "src/icons/operationIcon";
import { FileType } from "src/models/File";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { isDecompressibleFile } from "src/utils/file";
import { convertToBytes } from "src/utils/format";
import { trpc } from "src/utils/trpc";
import { useTheme } from "styled-components";

import { urlToDownload } from "./api";
import { CreateFileModal } from "./CreateFileModal";
import { RenameModal } from "./RenameModal";

interface Props {
  cluster: Cluster;
  loginNodes: Record<string, string>;
  path: string;
  urlPrefix: string;
  setClusterId: React.Dispatch<React.SetStateAction<string>>;
}

const DEFAULT_FILE_PREVIEW_LIMIT_SIZE = "50m";

type FileInfoKey = React.Key;

type FileInfo = inferRouterOutputs<AppRouter>["file"]["listDirectory"][0];

const fileInfoKey = (f: FileInfo, path: string): string => join(path, f.name);

interface PromiseSettledResult {
  status: string;
  value?: FileInfo | undefined;
}

export interface Compression {
  started: string[];
  completed: string[];
}

enum UploadType {
  File = "file",
  Dir = "dir",
}

export const FileManager: React.FC<Props> = ({ cluster, path, urlPrefix, setClusterId }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.fileManager.");
  const languageId = useI18n().currentLanguage.id;

  const theme = useTheme();

  const operationTexts = {
    copy: t(p("copy")),
    move: t(p("move")),
  };
  const { message, modal } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { publicConfig, scowClusterConfigs, user } = usePublicConfig();

  const [selectedKeys, setSelectedKeys] = useState<FileInfoKey[]>([]);
  const { operation, setOperation, filePrevPath, setFilePrevPath } = useFileManager();
  const [showHiddenFile, setShowHiddenFile] = useState(false);
  const [decompression, setDecompression] = useState<Compression>({ started: [], completed: [] });
  const [compression, setCompression] = useState<Compression>({ started: [], completed: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const filesQuery = trpc.file.listDirectory.useQuery(
    {
      clusterId: cluster.id,
      path,
    },
    {
      enabled: path !== "~",
      retry: 1,
    },
  );

  const { data: homeDirData } = trpc.file.getHomeDir.useQuery({ clusterId: cluster.id });
  const homePath = homeDirData?.path;

  const enrichedEntryPaths = React.useMemo(() => {
    const entryPaths = scowClusterConfigs[cluster.id]?.entryPaths;
    return buildEnrichedEntryPaths(entryPaths, user?.identityId);
  }, [scowClusterConfigs, cluster.id, user?.identityId]);

  const selectedEntryIndex = useAutoSelectSidebar(path, homePath, enrichedEntryPaths, "~");

  // 暂时注释掉AI部分的存储系统显示
  // 后续支持再展示相关信息
  // const { data: storageInfos } = trpc.file.getUserStorageInfo.useQuery(
  //   { clusterId: cluster.id },
  //   {
  //     enabled: hasClusterQuotaEnabledStorage(
  //       scowClusterConfigs[cluster.id].entryPaths, publicConfig.PUBLIC_STORAGE_CONFIG)
  //   },
  // );

  // const clusterStorageConfigs = React.useMemo(() => {
  //   const entryPaths = scowClusterConfigs[cluster.id]?.entryPaths;
  //   if (!entryPaths || !publicConfig.PUBLIC_STORAGE_CONFIG) return [];
  //   return getClusterStorageConfigs(entryPaths, publicConfig.PUBLIC_STORAGE_CONFIG);
  // }, [scowClusterConfigs, cluster.id]);

  // const selectedStorageConfig = useSelectedStorageConfig(path, clusterStorageConfigs);

  // 当前路径对应的存储配额信息：仅在 showQuotaInfo 时有效
  // const selectedStorageInfo = React.useMemo(() => {
  //   if (!storageInfos || !selectedStorageConfig) return null;
  //   const info = storageInfos.find((i) => i.storageId === selectedStorageConfig.storageId);
  //   if (!info) return null;
  //   return { info, config: selectedStorageConfig };
  // }, [storageInfos, selectedStorageConfig]);

  const reload = filesQuery.refetch;

  const fullUrl = (path: string) => join(urlPrefix, path);

  const up = () => {
    const paths = path.split("/");

    const newPath = paths.length === 1 ? path : "/" + paths.slice(0, paths.length - 1).join("/");
    router.replace(fullUrl(newPath));
  };

  const toHome = () => {
    router.push(fullUrl("~"));
  };

  const CompressFilesButton = RoundedModalButton(CompressionModal, {
    icon: <CompressIcon disabled={selectedKeys.length === 0} />,
    disabled: selectedKeys.length === 0,
    $color: theme.palette.gray[8],
  });

  const DecompressFilesButton = RoundedModalButton(DecompressionModal, {
    icon: (
      <DecompressIcon
        disabled={selectedKeys.length === 0 || selectedKeys.some((sKey) => !isDecompressibleFile(sKey.toString()))}
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

  useEffect(() => {
    if (path === "~") {
      return;
    }

    if (!filePrevPath) {
      setFilePrevPath(path);
    }

    setSelectedKeys([]);

    reload().then((res) => {
      if (res.isError) {
        const code = res.error?.data?.code;
        const rawErrMsg = res.error?.message ?? "";
        const isDirMissing =
          code === "NOT_FOUND" || (code === "BAD_REQUEST" && rawErrMsg.includes("no such file or directory"));

        const isEntryPathCreateFailed = res.error?.message === "ENTRY_PATH_CREATE_FAILED";
        const displayErrMsg =
          code === "FORBIDDEN"
            ? t(p("noAccessPermission"))
            : isDirMissing
              ? t(p("noPath"))
              : isEntryPathCreateFailed
                ? t(p("entryPathCreateFailed"))
                : res.error?.message;
        message.error(displayErrMsg);

        // 路径不存在时跳转到家目录
        toHome();
        return;
      }

      setFilePrevPath(path);
    });
  }, [path]);

  // Navigate to home directory when path is the placeholder "~"
  React.useEffect(() => {
    if (path === "~" && homePath) {
      router.replace(fullUrl(homePath));
    }
  }, [path, homePath]);

  const resetSelectedAndOperation = () => {
    setSelectedKeys([]);
    setOperation(undefined);
  };

  const copyOrMoveMutation = trpc.file.copyOrMove.useMutation();
  const checkFileExistMutation = trpc.file.checkFileExist.useMutation();

  const paste = async () => {
    if (!operation) {
      return;
    }
    const operationText = operationTexts[operation.op];

    setOperation({ ...operation, started: true });

    const getOperationErrorMessage = (error: any) => {
      const code = error?.data?.code;
      return code === "BAD_REQUEST"
        ? t(p("copyToItselfError"))
        : code === "CONFLICT"
          ? t(p("alreadyExist"))
          : code === "FORBIDDEN"
            ? t(p("noAccessPermission"))
            : code === "NOT_FOUND"
              ? t(p("noPath"))
              : (error?.message ?? t(p("operationErrorFallback")));
    };

    const pasteFile = async (x: FileInfo) => {
      await copyOrMoveMutation.mutateAsync({
        op: operation.op,
        clusterId: cluster.id,
        fromPath: join(operation.originalPath, x.name),
        toPath: join(path, x.name),
      });
      setOperation((o) => (o ? { ...operation, completed: o.completed.concat(x) } : undefined));
      return x;
    };

    let successfulCount = 0;
    let abandonCount = 0;
    const allCount = operation.selected.length;

    try {
      for (const x of operation.selected) {
        try {
          const { exists } = await checkFileExistMutation.mutateAsync({
            clusterId: cluster.id,
            path: join(path, x.name),
          });

          if (exists) {
            const { type } = await getFileTypeMutation.mutateAsync({
              clusterId: cluster.id,
              path: join(path, x.name),
            });
            const isDir = type === "DIR";
            const shouldOverwrite = await new Promise<boolean>((resolve, reject) => {
              modal.confirm({
                title: t(p(isDir ? "existedDirModalTitle" : "existedFileModalTitle")),
                content: t(
                  p(
                    operation.op === "copy"
                      ? isDir
                        ? "copyDirModalContent"
                        : "copyFileModalContent"
                      : isDir
                        ? "moveDirModalContent"
                        : "moveFileModalContent",
                  ),
                  [x.name],
                ),
                okText: t(p("existedModalOk")),
                cancelText: t("button.cancelButton"),
                onOk: async () => {
                  try {
                    await deleteMutation.mutateAsync({
                      clusterId: cluster.id,
                      target: isDir ? "DIR" : "FILE",
                      path: join(path, x.name),
                    });
                    resolve(true);
                  } catch (e) {
                    reject(e);
                  }
                },
                onCancel: () => {
                  abandonCount++;
                  resolve(false);
                },
              });
            });

            if (!shouldOverwrite) {
              continue;
            }
          }

          await pasteFile(x);
          successfulCount++;
        } catch (e) {
          console.error(e);
          modal.error({
            title: t(p("modalErrorTitle"), [x.name, operationText]),
            content: getOperationErrorMessage(e),
          });
        }
      }

      if (allCount - successfulCount - abandonCount) {
        message.error(
          t(p("errorMessage"), [
            operationText,
            allCount,
            successfulCount,
            abandonCount,
            allCount - successfulCount - abandonCount,
          ]),
        );
      } else if (successfulCount > 0) {
        message.success(t(p("successMessage"), [operationText, allCount, successfulCount, abandonCount]));
      }
    } finally {
      resetSelectedAndOperation();
      reload();
    }
  };

  const deleteMutation = trpc.file.deleteItem.useMutation();

  const getFileTypeMutation = trpc.file.getFileType.useMutation();

  const onDeleteClick = () => {
    const files = keysToFiles(selectedKeys);
    modal.confirm({
      title: t(p("confirmDelTitle")),
      content: `${t(p("confirmDelText"), [files.length])}`,
      onOk: async () => {
        await Promise.allSettled(
          files.map(async (x: FileInfo) => {
            return deleteMutation
              .mutateAsync({
                target: x.type,
                clusterId: cluster.id,
                path: join(path, x.name),
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
              message.success(`${t(p("delText"), [allCount])}`);
              resetSelectedAndOperation();
            } else {
              message.error(`${t(p("delText2"), [allCount - failedCount, failedCount])}`);
              setOperation((o) => o && { ...o, started: false });
            }
          })
          .catch((e) => {
            console.log(e);
            message.error(t(p("errorText1")));
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
    return filesQuery.data?.filter((x: FileInfo) => keys.includes(fileInfoKey(x, path))) ?? [];
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
        src: urlToDownload(cluster.id, join(path, filename), false, publicConfig.BASE_PATH),
      });
      return;
    } else if (!isNonEditableFilename(filename, publicConfig.NON_EDITABLE_FILENAME_POSTFIXES)) {
      setPreviewFile({
        open: true,
        filename,
        fileSize: fileSize,
        filePath: join(path, filename),
        clusterId: cluster.id,
      });
      return;
    } else {
      message.info(t(p("preview.unsupportedFileType")));
      return;
    }
  };

  // 递归解析符号链接的最终目标
  const resolveSymlinkTargetRecursively = async (
    initialPath: string,
    maxDepth = 20,
  ): Promise<{ finalPath: string; finalType: FileType; finalSize: number }> => {
    let currentPath = initialPath;
    let depth = 0;

    while (depth < maxDepth) {
      const meta = await getFileTypeMutation.mutateAsync({ clusterId: cluster.id, path: currentPath });
      const isSymlink = meta.isSymlink ?? meta.type === "SYMLINK";
      if (!isSymlink) {
        return { finalPath: currentPath, finalType: meta.type, finalSize: meta.size };
      }
      const nextPath = meta.linkTargetPath;
      const linkTargetType = meta.linkTargetType;
      if (!nextPath || !linkTargetType) {
        return { finalPath: currentPath, finalType: linkTargetType ?? "FILE", finalSize: meta.size };
      }
      currentPath = nextPath;
      depth += 1;
    }
    return { finalPath: currentPath, finalType: "SYMLINK", finalSize: 0 };
  };

  // 按解析结果进行跳转或预览
  const navigateResolvedSymlinkTarget = async (initialTargetPath: string) => {
    try {
      const { finalPath, finalType } = await resolveSymlinkTargetRecursively(initialTargetPath);
      if (finalType === "FILE") {
        const destDir = dirname(finalPath);
        const fileName = basename(finalPath);
        router.push(`${fullUrl(destDir)}?edit=${encodeURIComponent(fileName)}`);
      } else if (finalType === "DIR") {
        router.push(fullUrl(finalPath));
      } else {
        router.push(fullUrl(finalPath));
      }
    } catch (e: any) {
      message.error(`${t(p("failedResolveSymlink"))}${e?.message ? ": " + e.message : ""}`);
    }
  };

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadDirModalOpen, setIsUploadDirModalOpen] = useState(false);

  useEffect(() => {
    const uploadModalParam = searchParams?.get("uploadModalOpen");
    const uploadQuery = queryToString(uploadModalParam);
    if (uploadQuery === "true") {
      setIsUploadModalOpen(true);
    } else {
      setIsUploadModalOpen(false);
    }
  }, []);

  // Open file when ?edit=<filename> is present
  useEffect(() => {
    const editParam = searchParams?.get("edit");
    const editFileName = queryToString(editParam);
    if (editFileName) {
      const foundFile = filesQuery.data?.find((file) => file.name === editFileName);
      if (foundFile && foundFile.type !== "DIR") {
        handlePreview(editFileName, foundFile.size);
      }
    }
  }, [searchParams, filesQuery.data]);

  // Clear the ?edit=<filename> query when preview is closed to allow re-triggering
  useEffect(() => {
    const hasEditParam = searchParams?.has("edit");
    if (hasEditParam && !previewFile.open && !previewImage.visible) {
      router.replace(fullUrl(path));
    }
  }, [previewFile.open, previewImage.visible, searchParams, path]);

  const handleUploadModalClose = () => {
    setIsUploadModalOpen(false);
  };

  const handleUploadDirModalClose = () => {
    setIsUploadDirModalOpen(false);
  };

  const handleUploadMenuClick: MenuProps["onClick"] = (e) => {
    if ((e.key as UploadType) === UploadType.File) {
      setIsUploadModalOpen(true);
    } else {
      setIsUploadDirModalOpen(true);
    }
  };

  const uploadMenuItems: MenuProps["items"] = [
    {
      label: t(p("uploadMenuFile")),
      key: UploadType.File,
    },
    {
      label: t(p("uploadMenuDir")),
      key: UploadType.Dir,
    },
  ];

  const uploadMenuProps = {
    items: uploadMenuItems,
    onClick: handleUploadMenuClick,
  };

  const newMenuItems: MenuProps["items"] = [
    {
      label: (
        <CreateFileLink cluster={cluster} path={path} reload={reload}>
          {t(p("newMenuFile"))}
        </CreateFileLink>
      ),
      key: "newFile",
    },
    {
      label: (
        <MkdirLink clusterId={cluster.id} path={path} reload={reload}>
          {t(p("newMenuDir"))}
        </MkdirLink>
      ),
      key: "newDir",
    },
  ];

  const newMenuProps = {
    items: newMenuItems,
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
        <span>{t(p("fileManage"))}</span>
      </TitleText>
      <TopCard>
        <TopBar>
          <SelectPreFix>{`${t(p("cluster"))} :`}</SelectPreFix>
          <SingleClusterSelector
            style={{ minWidth: "160px", height: "36px" }}
            defaultValue={cluster}
            onChange={(val) => {
              setClusterId(val.id);
              resetSelectedAndOperation();
              toHome();
            }}
          />
          <UpButtonBox onClick={up}>
            <ForwardIcon />
          </UpButtonBox>
          <PathBar
            compact
            path={path}
            loading={filesQuery.isFetching}
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
        </TopBar>
        <OperationBar>
          <Space wrap>
            <Dropdown menu={newMenuProps}>
              <Button icon={<CreateIcon />} $color={theme.palette.gray[8]}>
                <Space>
                  {t(p("new"))}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
            <Dropdown menu={uploadMenuProps}>
              <Button icon={<UploadIcon />} $color={theme.palette.gray[8]}>
                <Space>
                  {t(p("upload"))}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
            <Button
              $color={theme.palette.gray[8]}
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
            >
              {t(p("copySelected"))}
            </Button>
            <Button
              $color={theme.palette.gray[8]}
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
            >
              {t(p("moveSelected"))}
            </Button>
            <Button
              $color={theme.palette.gray[8]}
              icon={<PasteIcon disabled={!operation || operation.started || operation.originalPath === path} />}
              onClick={paste}
              disabled={!operation || operation.started || operation.originalPath === path}
            >
              {t(p("pasteSelected"))}
            </Button>
            <CompressFilesButton
              clusterId={cluster.id}
              reload={reload}
              path={path}
              files={keysToFiles(selectedKeys)}
              setCompression={setCompression}
            >
              {t(p("compress"))}
            </CompressFilesButton>
            <Tooltip title={getDecompressButtonDisabledReason()}>
              <span>
                <DecompressFilesButton
                  clusterId={cluster.id}
                  reload={reload}
                  sourcePath={path}
                  files={keysToFiles(selectedKeys)}
                  setDecompression={setDecompression}
                >
                  {t(p("decompress"))}
                </DecompressFilesButton>
              </span>
            </Tooltip>
            <Button
              $color={theme.palette.gray[8]}
              icon={<FileDeleteIcon disabled={selectedKeys.length === 0 || !!operation?.started} />}
              onClick={onDeleteClick}
              disabled={selectedKeys.length === 0 || operation?.started}
            >
              {t(p("delSelected"))}
            </Button>
            {operation ? (
              operation.started ? (
                <span>
                  {`${t(p("ing"))}${operationTexts[operation.op]}，` +
                    `${t(p("completed"))} ${operation.completed.length} / ${operation.selected.length}`}
                </span>
              ) : (
                <span>
                  {`${t(p("select"))}${operationTexts[operation.op]}${operation.selected.length}${t(p("item"))}`}
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
                  {t(p("compressing"))}:{`${compression.completed.length} / ${compression.started.length}`}
                </span>
              </div>
            )}
            {decompression.started.length - decompression.completed.length > 0 && (
              <div>
                <span style={{ color: theme.token.colorPrimary }}>
                  {t(p("decompressing"))}:{`${decompression.completed.length} / ${decompression.started.length}`}
                </span>
              </div>
            )}
          </Space>
          <Space wrap>
            <span>{t(p("showHiddenFiles"))}</span>
            <Switch checked={showHiddenFile} onChange={onHiddenClick} />
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
              toHome();
            },
          },
          ...enrichedEntryPaths.map((entry, index) => ({
            key: index,
            label: getI18nConfigCurrentText(entry.displayName, languageId),
            icon: <EntryPathIcon disabled={selectedEntryIndex !== index} />,
            selected: selectedEntryIndex === index,
            onClick: () => {
              router.push(fullUrl(entry.resolvedPath));
            },
          })),
        ]}
        // AI不支持存储配额之前暂时隐藏存储信息显示
        // sidebarBottom={(
        //   <>
        //     <Divider style={{ margin: "8px 0" }} />
        //     {showQuotaInfo && selectedStorageInfo && (
        //       <StorageInfoSection>
        //         <div style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
        //           <StorageIcon />
        //           {getI18nConfigCurrentText(selectedStorageInfo.config.displayName, languageId)}
        //         </div>
        //         <Progress
        //           percent={selectedStorageInfo.info.quotaMb > 0
        //             ? Math.min(
        //               100,
        //               Math.round(
        //                 (Number(selectedStorageInfo.info.usedStorageMb) /
        //                   Number(selectedStorageInfo.info.quotaMb)) * 100,
        //               ),
        //             )
        //             : 0}
        //           size="small"
        //           status={
        //             selectedStorageInfo.info.quotaMb > 0 &&
        //               selectedStorageInfo.info.usedStorageMb >= selectedStorageInfo.info.quotaMb
        //               ? "exception" : "normal"
        //           }
        //           showInfo={false}
        //         />
        //         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        //           <span>
        //             {`${formatMBToGB(selectedStorageInfo.info.usedStorageMb).toFixed(2)} GB`}
        //             {" / "}
        //             {`${formatMBToGB(selectedStorageInfo.info.quotaMb).toFixed(2)} GB`}
        //             {selectedStorageInfo.config.replicaExist && (
        //               <Tooltip title={t(p("storageQuotaTooltip"))}>
        //                 <QuestionCircleOutlined style={{ marginLeft: 4 }} />
        //               </Tooltip>
        //             )}
        //           </span>
        //           <span>
        //             {selectedStorageInfo.info.quotaMb > 0
        //               ? `${Math.min(100, Math.round((Number(selectedStorageInfo.info.usedStorageMb) / Number(selectedStorageInfo.info.quotaMb)) * 100))}%`
        //               : "0%"
        //             }
        //           </span>
        //         </div>
        //       </StorageInfoSection>
        //     )}
        //   </>
        // )}
        collapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed((c) => !c)}
      >
        <FileTableWrapper $fillHeight $inFileManager>
          <FileTable
            files={filesQuery.data ?? []}
            filesFilter={(files) => files.filter((file) => showHiddenFile || !file.name.startsWith("."))}
            loading={filesQuery.isFetching}
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
                if (r.type === "DIR") {
                  router.push(fullUrl(join(path, r.name)));
                } else if (r.type === "FILE") {
                  handlePreview(r.name, r.size);
                } else if (r.type === "SYMLINK" && r.linkTargetPath) {
                  navigateResolvedSymlinkTarget(r.linkTargetPath);
                }
              },
            })}
            fileNameRender={(_, r) =>
              r.type === "DIR" ? (
                <Link href={fullUrl(join(path, r.name))} passHref style={{ color: "inherit", textDecoration: "none" }}>
                  {r.name}
                </Link>
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
                      const initialPath = r.linkTargetPath ?? join(path, r.name);
                      navigateResolvedSymlinkTarget(initialPath);
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
              <Space>
                {i.type === "FILE" && (
                  <Tooltip title={t(p("download"))}>
                    <a href={urlToDownload(cluster.id, join(path, i.name), true, publicConfig.BASE_PATH)}>
                      <DownloadIcon />
                    </a>
                  </Tooltip>
                )}
                <RenameLink cluster={cluster} path={join(path, i.name)} reload={reload} isFile={i.type !== "DIR"}>
                  <Tooltip title={t(p("rename"))}>
                    <RenameIcon />
                  </Tooltip>
                </RenameLink>
                <Tooltip title={t("button.deleteButton")}>
                  <DeleteIcon
                    onClick={() => {
                      const fullPath = join(path, i.name);
                      modal.confirm({
                        title: t(p("confirmDelTitle")),
                        content: `${t(p("confirmDelTitle"))}${fullPath}？`,
                        okText: t("button.confirmButton"),
                        onOk: () => {
                          deleteMutation.mutate(
                            {
                              target: i.type,
                              clusterId: cluster.id,
                              path: fullPath,
                            },
                            {
                              onSuccess: () => {
                                message.success(t(p("delSuccessful")));
                                resetSelectedAndOperation();
                                reload();
                              },
                            },
                          );
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
      <FileEditModal previewFile={previewFile} setPreviewFile={setPreviewFile} />
      <UploadModal
        open={isUploadModalOpen}
        onClose={handleUploadModalClose}
        clusterId={cluster.id}
        path={path}
        reload={reload}
      />
      <UploadDirModal
        open={isUploadDirModalOpen}
        onClose={handleUploadDirModalClose}
        clusterId={cluster.id}
        path={path}
        reload={reload}
      />
    </div>
  );
};

const RenameLink = ModalLink(RenameModal);
const CreateFileLink = ModalLink(CreateFileModal);
const MkdirLink = ModalLink(MkdirModal);
