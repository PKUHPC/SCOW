import type { inferRouterOutputs } from "@trpc/server";

import {
  CompressOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  ExpandOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  HomeOutlined,
  QuestionCircleOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  UploadOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { formatBytesToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { isImage, isNonEditableFilename } from "@scow/lib-web/build/utils/staticFiles";
import { App, Button, Divider, Dropdown, MenuProps, Space, Tooltip } from "antd";
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
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ImagePreviewer } from "src/components/ImagePreviewer";
import { MkdirModal } from "src/components/MkdirModal";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { TableTitle } from "src/components/TableTitle";
import { UploadDirModal } from "src/components/UploadDirModal";
import { UploadModal } from "src/components/UploadModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DeleteIcon, DownloadIcon, RenameIcon } from "src/icons/operationIcon";
import { FileType } from "src/models/File";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { isDecompressibleFile } from "src/utils/file";
import { convertToBytes } from "src/utils/format";
import { trpc } from "src/utils/trpc";
import { styled, useTheme } from "styled-components";

import { urlToDownload } from "./api";
import { CreateFileModal } from "./CreateFileModal";
import { PathBar } from "./PathBar";
import { RenameModal } from "./RenameModal";

interface Props {
  cluster: Cluster;
  loginNodes: Record<string, string>;
  path: string;
  urlPrefix: string;
  setClusterId: React.Dispatch<React.SetStateAction<string>>;
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

  const theme = useTheme();

  const operationTexts = {
    copy: t(p("copy")),
    move: t(p("move")),
  };
  const { message, modal } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { publicConfig, scowClusterConfigs } = usePublicConfig();

  const [selectedKeys, setSelectedKeys] = useState<FileInfoKey[]>([]);
  const { operation, setOperation, filePrevPath, setFilePrevPath } = useFileManager();
  const [showHiddenFile, setShowHiddenFile] = useState(false);
  const [decompression, setDecompression] = useState<Compression>({ started: [], completed: [] });
  const [compression, setCompression] = useState<Compression>({ started: [], completed: [] });

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

  const { data: storageInfos } = trpc.file.getUserStorageInfo.useQuery(
    { clusterId: cluster.id, paths: "" },
    { enabled: scowClusterConfigs[cluster.id]?.storage.enabled },
  );

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

  const CompressFilesButton = ModalButton(CompressionModal, {
    icon: <CompressOutlined />,
    disabled: selectedKeys.length === 0,
  });

  const DecompressFilesButton = ModalButton(DecompressionModal, {
    icon: <ExpandOutlined />,
    disabled: selectedKeys.length === 0 || selectedKeys.some((sKey) => !isDecompressibleFile(sKey.toString())),
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
        const errMsg =
          code === "FORBIDDEN"
            ? t(p("noAccessPermission"))
            : code === "NOT_FOUND"
              ? t(p("noPath"))
              : res.error?.message;
        message.error(errMsg);

        if (filePrevPath && filePrevPath !== path) {
          router.push(fullUrl(filePrevPath));
        }
        return;
      }

      setFilePrevPath(path);
    });
  }, [path]);

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
            const shouldOverwrite = await new Promise<boolean>((resolve, reject) => {
              modal.confirm({
                title: t(p("existModalTitle")),
                content: t(p("existModalContent"), [x.name]),
                okText: t(p("existModalOk")),
                onOk: async () => {
                  try {
                    const fileType = await getFileTypeMutation.mutateAsync({
                      clusterId: cluster.id,
                      path: join(path, x.name),
                    });
                    await deleteMutation.mutateAsync({
                      clusterId: cluster.id,
                      target: fileType.type === "DIR" ? "DIR" : "FILE",
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
      } else {
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
      label: t(p("uploadFile")),
      key: UploadType.File,
    },
    {
      label: t(p("uploadDir")),
      key: UploadType.Dir,
    },
  ];

  const uploadMenuProps = {
    items: uploadMenuItems,
    onClick: handleUploadMenuClick,
  };

  return (
    <div>
      <TitleText>
        <span>{t(p("fileManage"))}</span>
      </TitleText>
      <TopBar>
        <SelectPreFix>{t(p("cluster"))}:</SelectPreFix>
        <SingleClusterSelector
          defaultValue={cluster}
          onChange={(val) => {
            setClusterId(val.id);
            // 重置已复制项和操作
            resetSelectedAndOperation();
            // 集群ID被切换时，确保返回家目录
            toHome();
          }}
        />
        <Button onClick={toHome} icon={<HomeOutlined />} shape="circle" />
        <Button onClick={up} icon={<UpOutlined />} shape="circle" />
        <PathBar
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
            index === 0 ? (
              <DatabaseOutlined />
            ) : (
              <Link href={fullUrl(path)} key={index} onClick={(e) => e.stopPropagation()}>
                {pathSegment}
              </Link>
            )
          }
        />
      </TopBar>
      <OperationBar>
        <Space wrap>
          {scowClusterConfigs[cluster.id]?.scowdEnabled ? (
            <Dropdown menu={uploadMenuProps}>
              <Button icon={<UploadOutlined />}>
                <Space>
                  上传
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          ) : (
            <UploadButton
              externalOpen={isUploadModalOpen}
              clusterId={cluster.id}
              path={path}
              reload={reload}
              scowdEnabled={scowClusterConfigs[cluster.id]?.scowdEnabled}
            >
              {t(p("upload"))}
            </UploadButton>
          )}
          <Divider type="vertical" />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={onDeleteClick}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("delSelected"))}
          </Button>
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
            {t(p("copySelected"))}
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
            {t(p("moveSelected"))}
          </Button>
          <Button
            icon={<SnippetsOutlined />}
            onClick={paste}
            disabled={!operation || operation.started || operation.originalPath === path}
          >
            {t(p("pasteSelected"))}
          </Button>
          {scowClusterConfigs[cluster.id]?.scowdEnabled && (
            <>
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
            </>
          )}
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
          <Button onClick={onHiddenClick} icon={showHiddenFile ? <EyeInvisibleOutlined /> : <EyeOutlined />}>
            {showHiddenFile ? t(p("noDisplay")) : t(p("display"))}
            {t(p("hidden"))}
          </Button>
          <CreateFileButton cluster={cluster} path={path} reload={reload}>
            {t(p("newFile"))}
          </CreateFileButton>
          <MkdirButton clusterId={cluster.id} path={path} reload={() => reload()}>
            {t(p("newDir"))}
          </MkdirButton>
        </Space>
      </OperationBar>

      <TableTitle justify="space-between">
        {storageInfos && (
          <div>
            <span>
              <Space>
                {`${t(p("storageQuota"))}(${scowClusterConfigs[cluster.id].storage.paths[0]})`}:
                <strong>{formatBytesToGB(storageInfos[0].quotaBytes).toFixed(2) + " GB"}</strong>
              </Space>
            </span>
            <Divider type="vertical" />
            <span>
              <Space>
                {t(p("usage"))}:<strong>{formatBytesToGB(storageInfos[0].usedStorageBytes).toFixed(2) + " GB"}</strong>
                {scowClusterConfigs[cluster.id].storage.replicaExist && (
                  <Tooltip title={t(p("storageQuotaTooltip"))}>
                    <QuestionCircleOutlined />
                  </Tooltip>
                )}
              </Space>
            </span>
          </div>
        )}
      </TableTitle>
      <FileTable
        files={filesQuery.data ?? []}
        filesFilter={(files) => files.filter((file) => showHiddenFile || !file.name.startsWith("."))}
        loading={filesQuery.isFetching}
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
            <RenameLink cluster={cluster} path={join(path, i.name)} reload={reload}>
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
                    // icon: < />,
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
      <ImagePreviewer previewImage={previewImage} setPreviewImage={setPreviewImage} />
      <FileEditModal previewFile={previewFile} setPreviewFile={setPreviewFile} />
      <UploadModal
        open={isUploadModalOpen}
        onClose={handleUploadModalClose}
        clusterId={cluster.id}
        path={path}
        reload={reload}
        scowdEnabled={scowClusterConfigs[cluster.id]?.scowdEnabled}
      />
      <UploadDirModal
        open={isUploadDirModalOpen}
        onClose={handleUploadDirModalClose}
        clusterId={cluster.id}
        path={path}
        reload={reload}
        scowdEnabled={scowClusterConfigs[cluster.id]?.scowdEnabled}
      />
    </div>
  );
};

const RenameLink = ModalLink(RenameModal);
const CreateFileButton = ModalButton(CreateFileModal, { icon: <FileAddOutlined /> });
const MkdirButton = ModalButton(MkdirModal, { icon: <FolderAddOutlined /> });
const UploadButton = ModalButton(UploadModal, { icon: <UploadOutlined /> });
