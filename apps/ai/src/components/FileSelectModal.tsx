import {
  ModalContainer,
  ModalContent,
  ModalFileListCard,
  ModalPathBarRow,
  ModalSidebarCard,
  ModalSidebarEntry,
  fileSelectModalStyles,
} from "@scow/lib-web/build/components/filemanager/FileSelectorModalLayout";
import { FileTableWrapper } from "@scow/lib-web/build/components/filemanager/FileTableWrapper";
import { PathBar } from "@scow/lib-web/build/components/filemanager/PathBar";
import {
  RoundedModalButton,
  AppRouterStyledModal as StyledModal,
} from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { useAutoSelectSidebar } from "@scow/lib-web/build/hooks/useAutoSelectSidebar";
import { fileIcon as FileIcon } from "@scow/lib-web/build/icons/commonIcons";
import { CreateIcon, DecompressIcon, EntryPathIcon, HomeDirIcon, UploadIcon } from "@scow/lib-web/build/icons/FileIcon";
import { formatPath } from "@scow/lib-web/build/utils/filePathUtils";
import { buildEnrichedEntryPaths } from "@scow/lib-web/build/utils/storageClusterHelper";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button } from "antd";
import Link from "next/link";
import { join } from "path";
import React, { Key, useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { FileInfo, FileType } from "src/models/File";
import { isParentOrSameFolderForWeb } from "src/utils/cluster";
import { fileInfoKey, getExtension, isDecompressibleFile } from "src/utils/file";
import { trpc } from "src/utils/trpc";
import { styled, useTheme } from "styled-components";

import { DecompressionModal } from "./DecompressionModal";
import { FileTable } from "./FileTable";
import { MkdirModal } from "./MkdirModal";
import { UploadModal } from "./UploadModal";

const FolderTriggerButton = styled(Button)`
  width: 40px !important;
  height: 24px !important;
  border-radius: 6px !important;
  border-style: none;
  background: ${({ theme }) => theme.token.colorPrimaryBg} !important;
  box-shadow: none !important;
  border-color: transparent !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  margin-inline-end: 16px;

  .anticon {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;

    svg {
      width: 20px !important;
      height: 32px !important;
    }
  }
`;

const FileSelectModalWrapper = styled(StyledModal)`
  ${fileSelectModalStyles}
`;

interface Props {
  clusterId: string;
  allowedExtensions?: string[];
  allowedFileType: FileType[];
  onSubmit: (path: string) => void;
  usePublicPath?: boolean; // 是否使用集群配置文件ai的clusterPublicPath
}

const NON_UTF8_PREFIX = "scow-enc-";

const hasNonUtf8Segment = (targetPath: string) =>
  targetPath
    .split("/")
    .filter(Boolean)
    .some((segment) => segment.startsWith(NON_UTF8_PREFIX));

export const FileSelectModal: React.FC<Props> = ({
  clusterId,
  allowedFileType,
  allowedExtensions,
  onSubmit,
  usePublicPath,
}) => {
  const onlyFile = allowedFileType.length === 1 && allowedFileType[0] === "FILE";

  const t = useI18nTranslateToString();
  const p = prefix("component.fileSelectModal.");
  const languageId = useI18n().currentLanguage.id;
  const theme = useTheme();
  const { scowClusterConfigs, user } = usePublicConfig();

  // 使用 useMemo 计算 rootPath，避免每次渲染都重新计算
  const rootPath = useMemo(() => {
    if (!usePublicPath) {
      return "~";
    }

    const clusterConfig = scowClusterConfigs[clusterId];
    const clusterPublicPath = clusterConfig?.ai?.clusterPublicPath;

    if (!clusterPublicPath) {
      console.warn(`Cluster ${clusterId} has no clusterPublicPath configured, using default home directory.`);
      return "~";
    }

    return clusterPublicPath;
  }, [usePublicPath, scowClusterConfigs, clusterId]);

  // 判断是否使用公共路径模式
  const isPublicPathMode = useMemo(() => rootPath !== "~", [rootPath]);

  const [visible, setVisible] = useState(false);
  const [prevPath, setPrevPath] = useState<string>(rootPath);
  const [path, setPath] = useState<string>(rootPath);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [selectedFileInfo, setSelectedFileInfo] = useState<FileInfo | undefined>(undefined);
  const enrichedEntryPaths = React.useMemo(() => {
    const entryPaths = scowClusterConfigs[clusterId]?.entryPaths;
    return buildEnrichedEntryPaths(entryPaths, user?.identityId);
  }, [scowClusterConfigs, clusterId, user?.identityId]);

  const decompressDisabled = selectedKeys.length === 0 || !isDecompressibleFile(selectedKeys[0].toString());
  const DecompressionModalButton = RoundedModalButton(DecompressionModal, {
    icon: <DecompressIcon disabled={decompressDisabled} />,
    disabled: decompressDisabled,
    $color: theme.palette.gray[8],
  });

  // theme 登录后不变，直接用空数组或只保留真正会变的依赖
  const MkdirButton = useMemo(
    () =>
      RoundedModalButton(MkdirModal, {
        icon: <CreateIcon />,
        $color: theme.palette.gray[8],
      }),
    [],
  );

  const UploadFileButton = useMemo(
    () =>
      RoundedModalButton(UploadModal, {
        icon: <UploadIcon />,
        $color: theme.palette.gray[8],
      }),
    [],
  );

  // 只在家目录模式下查询用户家目录
  const { data: homeDir, error: homeDirError } = trpc.file.getHomeDir.useQuery(
    { clusterId },
    {
      enabled: !!clusterId && !isPublicPathMode && path === "~" && visible,
      retry: false,
    },
  );

  const selectedEntryIndex = useAutoSelectSidebar(path, homeDir?.path, enrichedEntryPaths, "~");

  const { message } = App.useApp();

  useEffect(() => {
    if (visible && homeDirError) {
      message.error(`${t(p("homeDirError"))}： ${homeDirError.message}`);
    }
  }, [homeDirError, t, p, visible]);

  useEffect(() => {
    if (!visible || isPublicPathMode) return;
    if (!homeDir?.path || path !== "~") return;
    setPrevPath(homeDir.path);
    setPath(homeDir.path);
  }, [visible, isPublicPathMode, homeDir?.path, path]);

  // 查询目录内容
  const {
    data: curDirContent,
    refetch,
    isLoading: isDirContentLoading,
  } = trpc.file.listDirectory.useQuery(
    {
      clusterId: clusterId,
      path,
    },
    { enabled: !!clusterId && path !== "~" },
  );

  // 路径边界验证
  useEffect(() => {
    // 如果路径还是初始值，不进行验证
    if (path === rootPath) return;

    if (isPublicPathMode) {
      // 公共路径模式：直接用 rootPath 作为边界
      if (!isParentOrSameFolderForWeb(rootPath, path)) {
        message.info(t(p("onlyPublicPath")));
        setPath(prevPath);
      }
      return;
    }

    // 家目录模式：homeDir 还未加载时跳过
    if (!homeDir?.path) return;

    const allowed =
      isParentOrSameFolderForWeb(homeDir.path, path) ||
      enrichedEntryPaths.some((entry) => isParentOrSameFolderForWeb(entry.resolvedPath, path));

    if (!allowed) {
      message.info(t(p("onlyHomeDir")));
      setPath(prevPath);
    }
  }, [homeDir, path, rootPath, isPublicPathMode, enrichedEntryPaths, t, prevPath]);

  // 当 rootPath 改变时，重置所有状态
  useEffect(() => {
    setPrevPath(rootPath);
    setPath(rootPath);
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
  }, [rootPath]);

  const keysToFiles = (keys: React.Key[]) => {
    return curDirContent?.filter((x) => keys.includes(fileInfoKey(x, path))) ?? [];
  };

  const closeModal = () => {
    setVisible(false);
    setPrevPath(rootPath);
    setPath(rootPath);
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
  };

  const onOkClick = () => {
    const targetPath = selectedKeys.length > 0 ? selectedKeys[0].toString() : path;
    if (hasNonUtf8Segment(targetPath)) {
      message.info(t(p("nonUtf8NotAllowed")));
      return;
    }

    // 不选中文件夹的，直接把所在目录作为值
    if (!selectedFileInfo) {
      onSubmit(path);
      closeModal();
      return;
    }

    if (!checkFileSelectability(selectedFileInfo)) {
      message.info(getNotAllowedMessage());
      return;
    }

    if (selectedKeys.length > 0) {
      const selectedFilePath = selectedKeys[0].toString();
      onSubmit(selectedFilePath);
      closeModal();
    }
  };

  const onClickLink = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, clickPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPrevPath(path);
    setPath(formatPath(clickPath));
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
  };

  const checkFileSelectability = (fileInfo: FileInfo) => {
    return (
      allowedFileType.includes(fileInfo.type) &&
      (allowedExtensions === undefined || allowedExtensions.includes(getExtension(fileInfo.name)))
    );
  };

  const getNotAllowedMessage = () => {
    const isTarOnly = allowedExtensions?.length === 1 && allowedExtensions?.[0] === "tar";

    if (allowedFileType.length === 1 && allowedFileType[0] === "DIR") {
      return t(p("selectFolder"));
    }

    if (allowedFileType.length === 1 && allowedFileType[0] === "FILE" && isTarOnly) {
      return t(p("selectTarImage"));
    }

    return t(p("notAllowed"));
  };

  return (
    <>
      <FolderTriggerButton
        size="small"
        disabled={!clusterId}
        style={
          !clusterId
            ? {
                pointerEvents: "none", // 让点击事件穿透到 span
                opacity: 0.5, // 降低不透明度变灰
                filter: "grayscale(1)", // 强制灰度
              }
            : {}
        }
        onClick={() => {
          setVisible(true);
        }}
      >
        <FileIcon />
      </FolderTriggerButton>
      <FileSelectModalWrapper
        width="min(970px, calc(100vw - 32px))"
        // 高度限制：大屏 632px，小屏不超过 60vh
        styles={{
          content: {
            height: "min(632px, 60vh)",
          },
        }}
        centered // 确保开启此属性
        open={visible}
        onCancel={() => {
          closeModal();
        }}
        destroyOnClose
        title={onlyFile ? t(p("selectFile")) : t(p("select"))}
        footer={[
          <div
            key="footer"
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 36,
            }}
          >
            <div key="left" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <UploadFileButton path={path} clusterId={clusterId} reload={refetch}>
                {t(p("upload"))}
              </UploadFileButton>
              <MkdirButton key="new" clusterId={clusterId} path={join("/", path)} reload={refetch}>
                {t(p("mkdir"))}
              </MkdirButton>
              <DecompressionModalButton
                clusterId={clusterId}
                reload={refetch}
                sourcePath={path}
                files={keysToFiles(selectedKeys)}
                usePublicPath={usePublicPath}
              >
                {t(p("depression"))}
              </DecompressionModalButton>
            </div>
            <div key="right" style={{ display: "flex", gap: 8 }}>
              <Button
                key="cancel"
                onClick={() => {
                  closeModal();
                }}
              >
                {t("button.cancelButton")}
              </Button>
              <Button key="ok" type="primary" onClick={onOkClick}>
                {t("button.confirmButton")}
              </Button>
            </div>
          </div>,
        ]}
      >
        <ModalContainer>
          <ModalPathBarRow>
            <PathBar
              compact
              path={formatPath(path)}
              loading={isDirContentLoading}
              onPathChange={async (curPath) => {
                if (!(curPath === path)) {
                  setPrevPath(path);
                  setPath(curPath);
                } else {
                  await refetch();
                }
              }}
              breadcrumbItemRender={(segment, index, curPath) =>
                index === 0 ? null : (
                  <Link href="" onClick={(e) => onClickLink(e, curPath)}>
                    {segment}
                  </Link>
                )
              }
            />
          </ModalPathBarRow>

          <ModalContent>
            <ModalSidebarCard>
              <ModalSidebarEntry
                $selected={selectedEntryIndex === "home"}
                onClick={() => {
                  if (homeDir?.path) {
                    setPrevPath(path);
                    setPath(homeDir.path);
                    setSelectedKeys([]); // 清空选中
                    setSelectedFileInfo(undefined); // 清空选中文件信息
                  }
                }}
              >
                <HomeDirIcon disabled={selectedEntryIndex !== "home"} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t(p("homeDirectory"))}</span>
              </ModalSidebarEntry>
              {enrichedEntryPaths.map((entry, index) => (
                <ModalSidebarEntry
                  key={index}
                  $selected={selectedEntryIndex === index}
                  onClick={() => {
                    setPrevPath(path);
                    setPath(entry.resolvedPath);
                    setSelectedKeys([]);
                    setSelectedFileInfo(undefined);
                  }}
                >
                  <EntryPathIcon disabled={selectedEntryIndex !== index} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {getI18nConfigCurrentText(entry.displayName, languageId)}
                  </span>
                </ModalSidebarEntry>
              ))}
            </ModalSidebarCard>

            <ModalFileListCard>
              <FileTableWrapper $fillHeight>
                <FileTable
                  files={curDirContent || []}
                  filesFilter={(files) => files.filter((file) => !file.name.startsWith("."))}
                  loading={isDirContentLoading}
                  fileNameRender={(fileName: string) => <Button type="link">{fileName}</Button>}
                  hiddenColumns={["mode", "action"]}
                  pagination={false}
                  rowKey={(r: FileInfo): React.Key => join(path, r.name)}
                  onRow={(r) => ({
                    onClick: () => {
                      setSelectedKeys([join(path, r.name)]);
                      setSelectedFileInfo(r);
                    },
                    onDoubleClick: () => {
                      if (r.type === "DIR") {
                        setPrevPath(path);
                        setPath(join(path, r.name));
                        setSelectedKeys([]);
                        setSelectedFileInfo(undefined);
                      }
                    },
                  })}
                  rowSelection={{
                    type: "radio",
                    selectedRowKeys: selectedKeys,
                    onChange: (key, record) => {
                      setSelectedKeys(key);
                      setSelectedFileInfo(record[0]);
                    },
                  }}
                />
              </FileTableWrapper>
            </ModalFileListCard>
          </ModalContent>
        </ModalContainer>
      </FileSelectModalWrapper>
    </>
  );
};
