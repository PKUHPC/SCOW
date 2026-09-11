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
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { useAutoSelectSidebar } from "@scow/lib-web/build/hooks/useAutoSelectSidebar";
import { fileIcon as FileIcon } from "@scow/lib-web/build/icons/commonIcons";
import { CreateIcon, EntryPathIcon, HomeDirIcon } from "@scow/lib-web/build/icons/FileIcon";
import { formatPath } from "@scow/lib-web/build/utils/filePathUtils";
import { buildEnrichedEntryPaths } from "@scow/lib-web/build/utils/storageClusterHelper";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Button } from "antd";
import Link from "next/link";
import { join } from "path";
import React, { Key, useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { FolderTriggerButton } from "src/components/FolderTriggerButton";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { FileTable } from "src/pageComponents/filemanager/FileTable";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { FileInfo } from "src/pages/api/file/list";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { Cluster } from "src/utils/cluster";
import { styled } from "styled-components";

const FileSelectModalWrapper = styled(StyledModal)`
  ${fileSelectModalStyles}
`;

interface Props {
  cluster: Cluster;
  onSubmit: (path: string) => void;
}

const p = prefix("pageComp.job.fileSelectModal.");
const pFileManager = prefix("pageComp.fileManagerComp.fileManager.");

export const FileSelectModal: React.FC<Props> = ({ cluster, onSubmit }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { fullClusterConfigs } = useStore(ClusterInfoStore);
  const { user } = useStore(UserStore);

  const { data: homeDirectory, isLoading: isGettingHomeDirectoryLoading } = useAsync({
    promiseFn: useCallback(async () => api.getHomeDirectory({ query: { cluster: cluster.id } }), [cluster.id]),
  });

  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState<string>("/");
  const [prevPath, setPrevPath] = useState<string>("/");
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  // Build sidebar entries from cluster config
  const enrichedEntryPaths = useMemo(() => {
    const clusterConfig = fullClusterConfigs[cluster.id];
    return buildEnrichedEntryPaths(clusterConfig?.entryPaths, user?.identityId);
  }, [fullClusterConfigs, cluster.id, user?.identityId]);

  const listFilePromiseFn = useCallback(async () => {
    return visible ? await api.listFile({ query: { cluster: cluster.id, path: join("/", path) } }) : { items: [] };
  }, [path, cluster, visible]);

  const {
    data,
    isLoading: isFileLoading,
    reload,
  } = useAsync({
    promiseFn: listFilePromiseFn,
    onResolve(_) {
      setPrevPath(path);
    },
    onReject(_) {
      setPath(prevPath);
    },
  });

  const fileFilter = (files: FileInfo[]): FileInfo[] => {
    return files.filter((file) => file.type === "DIR" && !file.name.startsWith("."));
  };

  const selectedEntryIndex = useAutoSelectSidebar(path, homeDirectory?.path, enrichedEntryPaths);

  useEffect(() => {
    setPath(homeDirectory?.path ?? "/");
  }, [homeDirectory]);

  const navigateTo = (target: string) => {
    setPrevPath(path);
    setPath(target);
    setSelectedKeys([]);
  };

  const closeModal = () => {
    setVisible(false);
    setPath(homeDirectory?.path ?? "/");
    setSelectedKeys([]);
  };

  const onOkClick = () => {
    const submitPath = selectedKeys.length > 0 ? selectedKeys[0].toString() : path;
    onSubmit(submitPath);
    closeModal();
  };

  const onClickLink = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, clickPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigateTo(formatPath(clickPath));
  };

  return (
    <>
      <FolderTriggerButton
        loading={isGettingHomeDirectoryLoading}
        onClick={() => {
          setVisible(true);
        }}
      >
        <FileIcon />
      </FolderTriggerButton>
      <FileSelectModalWrapper
        // 宽度限制：大屏 970px，小屏随视口短边缩放
        width="min(970px, calc(100vw - 32px))"
        // 高度限制：大屏 632px，小屏不超过 60vh
        styles={{
          content: {
            height: "min(632px, 60vh)",
          },
        }}
        open={visible}
        centered
        onCancel={() => {
          closeModal();
        }}
        title={t(p("title"))}
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
            <div key="left">
              <MkdirButton key="new" cluster={cluster.id} path={join("/", path)} reload={reload}>
                {t(p("newPath"))}
              </MkdirButton>
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
              loading={isFileLoading}
              onPathChange={(curPath) => {
                const absPath = formatPath(curPath);
                if (absPath === path) {
                  reload();
                } else {
                  navigateTo(absPath);
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
                  if (homeDirectory?.path) navigateTo(homeDirectory.path);
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
                  files={data?.items || []}
                  filesFilter={fileFilter}
                  fileNameRender={(fileName: string) => <Button type="link">{fileName}</Button>}
                  hiddenColumns={["size", "mode", "action"]}
                  loading={isFileLoading}
                  pagination={false}
                  rowKey={(r: FileInfo): React.Key => join(path, r.name)}
                  onRow={(r) => ({
                    onClick: () => {
                      setSelectedKeys([join(path, r.name)]);
                    },
                    onDoubleClick: () => {
                      navigateTo(join(path, r.name));
                    },
                  })}
                  rowSelection={{
                    type: "radio",
                    selectedRowKeys: selectedKeys,
                    onChange: setSelectedKeys,
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
