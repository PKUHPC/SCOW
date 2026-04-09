import type { DataNode, EventDataNode } from "antd/es/tree";

import { DatabaseOutlined, ExpandOutlined, FolderAddOutlined, UploadOutlined } from "@ant-design/icons";
import { fileIcon as FileIcon } from "@scow/lib-web/build/icons/commonIcons";
import { App, Button, Modal, Tree } from "antd";
import Link from "next/link";
import { join } from "path";
import React, { Key, useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo, FileType } from "src/models/File";
import { fileInfoKey, getExtension, isDecompressibleFile, isParentOrSameFolder } from "src/utils/file";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { DecompressionModal } from "./DecompressionModal";
import { FileTable } from "./FileTable";
import { MkdirModal } from "./MkdirModal";
import { PathBar } from "./PathBar";
import { UploadModal } from "./UploadModal";

const { DirectoryTree } = Tree;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const TopBar = styled(FilterFormContainer)`
  display: flex;
  flex-direction: row;
  padding-bottom: 8px;
  width: 100%;
  & > button {
    margin: 0px 4px;
  }
`;

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

interface Props {
  clusterId: string;
  allowedExtensions?: string[];
  allowedFileType: FileType[];
  onSubmit: (path: string) => void;
  usePublicPath?: boolean; // 是否使用集群配置文件ai的clusterPublicPath
}

interface DirContent {
  type: string;
  name: string;
  mtime: string;
  size: number;
  mode: number;
}

function convertToDirTree(data: DirContent[], targetKey: string): DataNode[] {
  const sortedData = data.sort((a, b) => {
    if (a.type === "DIR" && b.type !== "DIR") {
      return -1;
    } else if (a.type !== "DIR" && b.type === "DIR") {
      return 1;
    }
    return 0;
  });

  // 转换为 treeData 格式
  return sortedData.map((item) => ({
    title: item.name,
    key: join(targetKey, item.name),
    isLeaf: item.type === "FILE",
  }));
}

function updateTreeData(
  treeData: DataNode[],
  rootPath: string,
  targetKey: string,
  newChildren: DirContent[],
): DataNode[] {
  if (targetKey === rootPath) {
    return convertToDirTree(newChildren, rootPath);
  }
  return treeData.map((node) => {
    // 如果找到了目标节点（即当前目录）
    if (node.key === targetKey) {
      // 将新内容转换为 DataNode[] 并设置为 children
      const childrenNodes = convertToDirTree(newChildren, targetKey);
      return { ...node, children: childrenNodes };
    }

    // 如果当前节点有子节点,递归地更新它们
    if (node.children) {
      return { ...node, children: updateTreeData(node.children, rootPath, targetKey, newChildren) };
    }

    return node;
  });
}

// 处理path的特殊情况,比如为空或者不以"/"开头
const formatPath = (path: string) => {
  if (path === "" || path === undefined) {
    return "/";
  }
  if (!path.startsWith("/")) {
    return "/" + path;
  }
  return path;
};

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
  const { scowClusterConfigs } = usePublicConfig();

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
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [dirTree, setDirTree] = useState<DataNode[]>([]);
  const [boundaryPath, setBoundaryPath] = useState<string>(rootPath);

  const DecompressionModalButton = ModalButton(DecompressionModal, {
    icon: <ExpandOutlined />,
    disabled: selectedKeys.length === 0 || !isDecompressibleFile(selectedKeys[0].toString()),
  });

  // 只在家目录模式下查询用户家目录
  const { data: homeDir, error: homeDirError } = trpc.file.getHomeDir.useQuery(
    { clusterId },
    {
      enabled: !!clusterId && !isPublicPathMode && path === "~" && visible,
      retry: false,
    },
  );

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
    setBoundaryPath(homeDir.path);
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

    let actualBoundary: string | undefined;

    if (isPublicPathMode) {
      // 公共路径模式：直接使用 rootPath 作为边界
      actualBoundary = rootPath;
    } else {
      // 家目录模式：使用 homeDir.path 作为边界
      if (!homeDir?.path) return;
      actualBoundary = homeDir.path;
    }

    // 检查当前路径是否在边界内
    if (!isParentOrSameFolder(actualBoundary, path)) {
      const errorMessage = isPublicPathMode ? t(p("onlyPublicPath")) : t(p("onlyHomeDir"));

      message.info(errorMessage);
      setPath(prevPath);
    }
  }, [homeDir, path, rootPath, isPublicPathMode]);

  // 更新目录树
  useEffect(() => {
    if (!visible || !curDirContent) return;

    if (dirTree.length === 0) {
      setDirTree(convertToDirTree(curDirContent, path));
    } else {
      setDirTree(updateTreeData(dirTree, boundaryPath, path, curDirContent));
    }
  }, [visible, curDirContent, path, boundaryPath, dirTree.length]);

  // 当 rootPath 改变时，重置所有状态
  useEffect(() => {
    setPrevPath(rootPath);
    setPath(rootPath);
    setBoundaryPath(rootPath);
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
    setExpandedKeys([]);
    setDirTree([]);
  }, [rootPath]);

  const keysToFiles = (keys: React.Key[]) => {
    return curDirContent?.filter((x) => keys.includes(fileInfoKey(x, path))) ?? [];
  };

  const onDirExpand = (expandDirs: Key[], { node, expanded }: { node: EventDataNode<DataNode>; expanded: boolean }) => {
    const expandDirSet = new Set(expandDirs);
    if (!expanded) {
      node.children?.forEach((children) => {
        if (expandDirSet.has(children.key)) {
          expandDirSet.delete(children.key);
        }
      });
    }
    const newExpandedKeys = Array.from(expandDirSet);
    setExpandedKeys(newExpandedKeys);
    if (!node.isLeaf) {
      setPrevPath(path);
      setPath(node.key.toString());
    }
  };

  const onLoadDir = async ({ key }: any) => {
    setPrevPath(path);
    setPath(key);
  };

  const closeModal = () => {
    setVisible(false);
    setPrevPath(rootPath);
    setPath(rootPath);
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
    setExpandedKeys([]);
    setDirTree([]);
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

    if (
      allowedFileType.length === 1
      && allowedFileType[0] === "FILE"
      && isTarOnly
    ) {
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
      <Modal
        width={1000}
        open={visible}
        onCancel={() => {
          closeModal();
        }}
        destroyOnClose
        title={onlyFile ? t(p("selectFile")) : t(p("select"))}
        centered
        footer={[
          <div key="footer" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
            <div key="left">
              <UploadFileButton
                path={path}
                clusterId={clusterId}
                scowdEnabled={scowClusterConfigs[clusterId]?.scowdEnabled}
                reload={async () => {
                  await refetch();
                  setDirTree(updateTreeData(dirTree, boundaryPath, path, curDirContent ?? []));
                }}
              >
                {t(p("upload"))}
              </UploadFileButton>
              <MkdirButton
                key="new"
                clusterId={clusterId}
                path={join("/", path)}
                reload={async (dirName: string) => {
                  await refetch();
                  setDirTree(updateTreeData(dirTree, boundaryPath, join(path, dirName), curDirContent ?? []));
                }}
              >
                {t(p("mkdir"))}
              </MkdirButton>
              {scowClusterConfigs[clusterId]?.scowdEnabled && (
                <DecompressionModalButton
                  clusterId={clusterId}
                  reload={async () => {
                    await refetch();
                    setDirTree(updateTreeData(dirTree, boundaryPath, path, curDirContent ?? []));
                  }}
                  sourcePath={path}
                  files={keysToFiles(selectedKeys)}
                  usePublicPath={usePublicPath}
                >
                  {t(p("depression"))}
                </DecompressionModalButton>
              )}
            </div>
            <div key="right">
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
          <TopBar>
            <PathBar
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
                index === 0 ? (
                  <Link href="" onClick={(e) => onClickLink(e, "/")}>
                    <DatabaseOutlined />
                  </Link>
                ) : (
                  <Link href="" onClick={(e) => onClickLink(e, curPath)}>
                    {segment}
                  </Link>
                )
              }
            />
          </TopBar>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
              alignItems: "flex-start",
            }}
          >
            <DirectoryTree
              style={{
                width: 240,
                height: 541,
                overflow: "auto",
                border: "1px solid #e0e0e0",
                borderRadius: "5px",
              }}
              showLine
              selectedKeys={[path]}
              expandedKeys={expandedKeys}
              loadData={onLoadDir}
              onExpand={onDirExpand}
              treeData={dirTree}
            />
            <div
              style={{
                width: "100%",
                overflowX: "auto",
                marginLeft: "6px",
                display: "flex",
                flex: 1,
                border: "1px solid #e0e0e0",
                borderRadius: "5px",
              }}
            >
              <FileTable
                style={{ flex: 1, overflowX: "auto" }}
                files={curDirContent || []}
                filesFilter={(files) => files.filter((file) => !file.name.startsWith("."))}
                loading={isDirContentLoading}
                fileNameRender={(fileName: string) => (
                  <Button style={{ color: "#000" }} type="link">
                    {fileName}
                  </Button>
                )}
                hiddenColumns={["mtime", "mode", "action"]}
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
                scroll={{ x: true, y: 500 }}
              />
            </div>
          </div>
        </ModalContainer>
      </Modal>
    </>
  );
};

const MkdirButton = ModalButton(MkdirModal, { icon: <FolderAddOutlined /> });
const UploadFileButton = ModalButton(UploadModal, { icon: <UploadOutlined /> });
