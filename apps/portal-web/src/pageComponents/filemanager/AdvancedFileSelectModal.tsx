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
import { RoundedModalButton, StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { useAutoSelectSidebar } from "@scow/lib-web/build/hooks/useAutoSelectSidebar";
import { CreateIcon, DecompressIcon, EntryPathIcon, HomeDirIcon, UploadIcon } from "@scow/lib-web/build/icons/FileIcon";
import { formatPath } from "@scow/lib-web/build/utils/filePathUtils";
import { buildEnrichedEntryPaths } from "@scow/lib-web/build/utils/storageClusterHelper";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { matchesFileExtension } from "@scow/utils";
import { Button, message } from "antd";
import Link from "next/link";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { FileInfo, FileType } from "src/pages/api/file/list";
import { isDecompressibleFile } from "src/server/file";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { fileInfoKey } from "src/utils/file";
import { styled, useTheme } from "styled-components";

const FileSelectModalWrapper = styled(StyledModal)`
  ${fileSelectModalStyles}
`;

import { PathBar } from "@scow/lib-web/build/components/filemanager/PathBar";
import { fileIcon as FileIcon } from "@scow/lib-web/build/icons/commonIcons";
import { FolderTriggerButton } from "src/components/FolderTriggerButton";

import { DecompressFilesModal } from "./DecompressFilesModal";
import { FileTable } from "./FileTable";
import { MkdirModal } from "./MkdirModal";
import { UploadModal } from "./UploadModal";

interface Props {
  clusterId: string;
  allowedExtensions?: string[];
  allowedFileType: FileType[];
  onSubmit: (path: string) => void;
}

const p = prefix("pageComp.app.advancedFileSelectModal.");
const pFileManager = prefix("pageComp.fileManagerComp.fileManager.");

export const AdvancedFileSelectModal: React.FC<Props> = ({
  clusterId,
  allowedFileType,
  allowedExtensions,
  onSubmit,
}) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const theme = useTheme();

  const { fullClusterConfigs } = useStore(ClusterInfoStore);
  const { user } = useStore(UserStore);

  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState<string>("~");
  const [prevPath, setPrevPath] = useState<string>("~");
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [selectedFileInfo, setSelectedFileInfo] = useState<FileInfo | undefined>(undefined);

  // Build sidebar entries from cluster config
  const enrichedEntryPaths = useMemo(() => {
    const clusterConfig = fullClusterConfigs[clusterId];
    return buildEnrichedEntryPaths(clusterConfig?.entryPaths, user?.identityId);
  }, [fullClusterConfigs, clusterId, user?.identityId]);

  const homeDirPromiseFn = useCallback(async () => {
    return visible ? await api.getHomeDirectory({ query: { cluster: clusterId } }) : { path: "~" };
  }, [visible]);

  const { data: homeDir, isLoading: isHomeDirLoading } = useAsync({
    promiseFn: homeDirPromiseFn,
    onResolve(data) {
      setPrevPath(data.path);
      setPath(data.path);
    },
    onReject(_) {
      message.info(t(p("getHomeDirError")));
    },
  });

  const selectedEntryIndex = useAutoSelectSidebar(path, homeDir?.path, enrichedEntryPaths, "~");

  const decompressDisabled = selectedKeys.length === 0 || !isDecompressibleFile(selectedKeys[0].toString());
  const DecompressionModalButton = RoundedModalButton(DecompressFilesModal, {
    icon: <DecompressIcon disabled={decompressDisabled} />,
    disabled: decompressDisabled,
    $color: theme.palette.gray[8],
  });

  const listFilePromiseFn = useCallback(async () => {
    return visible && path !== "~"
      ? await api.listFile({ query: { cluster: clusterId, path: join("/", path) } })
      : { items: [] };
  }, [visible, path]);

  const {
    data: curDirContent,
    isLoading: isDirContentLoading,
    reload: curDirContentReload,
  } = useAsync({
    promiseFn: listFilePromiseFn,
    onReject(_) {
      setPath(prevPath);
    },
  });

  const closeModal = () => {
    setVisible(false);
    setPrevPath("~");
    setPath("~");
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
  };

  const showSelectionError = (fileInfo?: FileInfo) => {
    if (
      fileInfo?.type === "FILE" &&
      allowedExtensions !== undefined &&
      !matchesFileExtension(fileInfo.name, allowedExtensions)
    ) {
      message.info(t(p("fileExtensionNotAllowed"), [allowedExtensions.join(", ")]));
    } else if (allowedFileType.length === 1 && allowedFileType[0] === "FILE") {
      message.info(t(p("fileRequired")));
    } else if (allowedFileType.length === 1 && allowedFileType[0] === "DIR") {
      message.info(t(p("directoryRequired")));
    } else {
      message.info(t(p("notAllowed")));
    }
  };

  const onOkClick = () => {
    if (!selectedFileInfo) {
      if (allowedFileType.includes("DIR")) {
        onSubmit(path);
        closeModal();
      } else {
        showSelectionError();
      }
      return;
    }

    if (!checkFileSelectability(selectedFileInfo)) {
      showSelectionError(selectedFileInfo);
      return;
    }

    if (selectedKeys.length > 0) {
      onSubmit(selectedKeys[0].toString());
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
      (fileInfo.type !== "FILE" ||
        allowedExtensions === undefined ||
        matchesFileExtension(fileInfo.name, allowedExtensions))
    );
  };

  const filterVisibleFiles = useCallback(
    (files: FileInfo[]) =>
      files.filter(
        (file) =>
          !file.name.startsWith(".") &&
          (file.type !== "FILE" ||
            allowedExtensions === undefined ||
            matchesFileExtension(file.name, allowedExtensions)),
      ),
    [allowedExtensions],
  );

  useEffect(() => {
    if (selectedKeys.length === 0) {
      return;
    }

    const selectedKey = selectedKeys[0];
    const latestSelectedFile = filterVisibleFiles(curDirContent?.items ?? []).find(
      (file) => fileInfoKey(file, path) === selectedKey,
    );

    if (!latestSelectedFile) {
      setSelectedKeys([]);
      setSelectedFileInfo(undefined);
    } else if (latestSelectedFile !== selectedFileInfo) {
      setSelectedFileInfo(latestSelectedFile);
    }
  }, [curDirContent, filterVisibleFiles, path, selectedFileInfo, selectedKeys]);

  const keysToFiles = (keys: React.Key[]) => {
    return curDirContent?.items.filter((x) => keys.includes(fileInfoKey(x, path))) ?? [];
  };

  const navigateTo = (target: string) => {
    setPrevPath(path);
    setPath(target);
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
  };

  return (
    <>
      <FolderTriggerButton
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
        open={visible}
        onCancel={() => {
          closeModal();
        }}
        title={t(p("select"))}
        centered
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
            <div key="left" style={{ display: "flex", gap: 8 }}>
              <UploadFileButton
                cluster={clusterId}
                path={path}
                reload={async () => {
                  curDirContentReload();
                }}
              >
                {t(p("upload"))}
              </UploadFileButton>
              <MkdirButton key="new" cluster={clusterId} path={join("/", path)} reload={curDirContentReload}>
                {t(p("mkdir"))}
              </MkdirButton>
              <DecompressionModalButton
                cluster={clusterId}
                sourcePath={path}
                files={keysToFiles(selectedKeys)}
                reload={async () => {
                  curDirContentReload();
                }}
              >
                {t(p("decompression"))}
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
              loading={isDirContentLoading || isHomeDirLoading}
              onPathChange={(curPath) => {
                if (curPath !== path) {
                  navigateTo(curPath);
                } else {
                  curDirContentReload();
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
                  if (homeDir?.path) navigateTo(homeDir.path);
                }}
              >
                <HomeDirIcon disabled={selectedEntryIndex !== "home"} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t(pFileManager("homeDirectory"))}</span>
              </ModalSidebarEntry>
              {enrichedEntryPaths.map((entry, index) => (
                <ModalSidebarEntry
                  key={index}
                  $selected={selectedEntryIndex === index}
                  onClick={() => navigateTo(entry.resolvedPath)}
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
                  files={curDirContent?.items || []}
                  filesFilter={filterVisibleFiles}
                  loading={isDirContentLoading || isHomeDirLoading}
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
                        navigateTo(join(path, r.name));
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

const MkdirButton = ModalButton(MkdirModal, { icon: <CreateIcon /> });
const UploadFileButton = ModalButton(UploadModal, { icon: <UploadIcon /> });
