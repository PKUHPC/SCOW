import type { DataNode, EventDataNode } from "antd/es/tree";

import { DatabaseOutlined, ExpandOutlined, FolderAddOutlined, UploadOutlined } from "@ant-design/icons";
import { matchesFileExtension } from "@scow/utils";
import { Button, message, Modal, Tree } from "antd";
import Link from "next/link";
import { join } from "path";
import React, { Key, useCallback, useEffect, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo, FileType } from "src/pages/api/file/list";
import { isDecompressibleFile, isParentOrSameFolder } from "src/server/file";
import { fileInfoKey } from "src/utils/file";
import { styled } from "styled-components";

import { DecompressFilesModal } from "./DecompressFilesModal";
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

interface Props {
  clusterId: string;
  allowedExtensions?: string[];
  allowedFileType: FileType[];
  onSubmit: (path: string) => void;
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
  homeDir: string,
  targetKey: string,
  newChildren: DirContent[],
): DataNode[] {
  if (targetKey === homeDir) {
    return convertToDirTree(newChildren, homeDir);
  }
  return treeData.map((node) => {
    // 如果找到了目标节点（即当前目录）
    if (node.key === targetKey) {
      // 将新内容转换为 DataNode[] 并设置为 children
      const childrenNodes = convertToDirTree(newChildren, targetKey);
      return { ...node, children: childrenNodes };
    }

    // 如果当前节点有子节点，递归地更新它们
    if (node.children) {
      return { ...node, children: updateTreeData(node.children, homeDir, targetKey, newChildren) };
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

export const AdvancedFileSelectModal: React.FC<Props> = ({
  clusterId,
  allowedFileType,
  allowedExtensions,
  onSubmit,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("pageComp.app.advancedFileSelectModal.");

  const [visible, setVisible] = useState(false);
  const [prevPath, setPrevPath] = useState<string>("~");
  const [path, setPath] = useState<string>("~");
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [selectedFileInfo, setSelectedFileInfo] = useState<FileInfo | undefined>(undefined);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [dirTree, setDirTree] = useState<DataNode[]>([]);

  const DecompressionModalButton = ModalButton(DecompressFilesModal, {
    icon: <ExpandOutlined />,
    disabled: selectedKeys.length === 0 || !isDecompressibleFile(selectedKeys[0].toString()),
  });

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

  useEffect(() => {
    if (!homeDir?.path || path === "~") return;

    if (!isParentOrSameFolder(homeDir.path, path)) {
      message.info(t(p("onlyHomeDir")));
      setPath(prevPath);
    }
  }, [homeDir, path]);

  useEffect(() => {
    if (!curDirContent || curDirContent?.items.length === 0) return;

    if (dirTree.length === 0) {
      setDirTree(convertToDirTree(curDirContent?.items, path));
    } else {
      setDirTree(updateTreeData(dirTree, homeDir?.path || "~", path, curDirContent?.items));
    }
  }, [curDirContent]);

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
    setPrevPath("~");
    setPath("~");
    setSelectedKeys([]);
    setSelectedFileInfo(undefined);
    setExpandedKeys([]);
    setDirTree([]);
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
    // 不选中文件夹的，直接把所在目录作为值
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

  return (
    <>
      <Button
        size="small"
        onClick={() => {
          setVisible(true);
        }}
      >
        <FolderAddOutlined />
      </Button>
      <Modal
        width={1000}
        open={visible}
        onCancel={() => {
          closeModal();
        }}
        title={t(p("select"))}
        centered
        footer={[
          <div key="footer" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
            <div key="left" style={{ display: "flex", gap: "10px" }}>
              <UploadFileButton
                cluster={clusterId}
                path={path}
                reload={async () => {
                  curDirContentReload();
                  setDirTree(updateTreeData(dirTree, homeDir?.path || "~", path, curDirContent?.items ?? []));
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
                  setDirTree(updateTreeData(dirTree, homeDir?.path || "~", path, curDirContent?.items ?? []));
                }}
              >
                {t(p("decompression"))}
              </DecompressionModalButton>
            </div>
            <div key="right" style={{ display: "flex", gap: "10px" }}>
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
              loading={isDirContentLoading || isHomeDirLoading}
              onPathChange={(curPath) => {
                if (!(curPath === path)) {
                  setPrevPath(path);
                  setPath(curPath);
                } else {
                  curDirContentReload();
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
          <div style={{ display: "flex", flexDirection: "row", width: "100%", alignItems: "flex-start" }}>
            <DirectoryTree
              style={{ width: 240, height: 541, overflow: "auto", border: "1px solid #e0e0e0", borderRadius: "5px" }}
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
                files={curDirContent?.items || []}
                filesFilter={filterVisibleFiles}
                loading={isDirContentLoading || isHomeDirLoading}
                fileNameRender={(fileName: string) => <Button type="link">{fileName}</Button>}
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
