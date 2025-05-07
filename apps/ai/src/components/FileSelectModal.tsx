/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { DatabaseOutlined, ExpandOutlined, FolderAddOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, message, Modal, Tree } from "antd";
import type { DataNode, EventDataNode } from "antd/es/tree";
import Link from "next/link";
import { join } from "path";
import React, { Key, useEffect, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileInfo, FileType } from "src/models/File";
import { getExtension, isDecompressibleFile, isParentOrSameFolder } from "src/utils/file";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { CompressionModal } from "./DecompressionModal";
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
  &>button {
    margin: 0px 4px;
  }
`;

interface Props {
  clusterId: string,
  allowedExtensions?: string[]
  allowedFileType: FileType[],
  onSubmit: (path: string) => void;
}

interface DirContent {
  type: string;
  name: string;
  mtime: string;
  size: number;
  mode: number;
};

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

function updateTreeData(treeData: DataNode[], homeDir: string,
  targetKey: string, newChildren: DirContent[]): DataNode[] {
  if (targetKey === homeDir) {
    return convertToDirTree(newChildren, homeDir);
  };
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
};

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


export const FileSelectModal: React.FC<Props> = ({ clusterId, allowedFileType, allowedExtensions, onSubmit }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.fileSelectModal.");

  const [visible, setVisible] = useState(false);
  const [prevPath, setPrevPath] = useState<string>("~");
  const [path, setPath] = useState<string>("~");
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [selectedFileInfo, setSelectedFileInfo] = useState<FileInfo | undefined>(undefined);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [dirTree, setDirTree] = useState<DataNode[]>([]);

  const CompressionModalButton = ModalButton(CompressionModal, { icon: <ExpandOutlined />,
    disabled: selectedKeys.length === 0 || !isDecompressibleFile(selectedKeys[0].toString()) });

  const { data: homeDir } = trpc.file.getHomeDir.useQuery({ clusterId }, {
    enabled: !!clusterId && path === "~" && visible,
    onSuccess(data) {
      setPrevPath(data.path);
      setPath(data.path);
    },
  });

  const { data: curDirContent, refetch, isLoading: isDirContentLoading } = trpc.file.listDirectory.useQuery({
    clusterId: clusterId,
    path,
  }, { enabled: !!clusterId && path !== "~" });

  useEffect(() => {
    if (!homeDir?.path || path === "~") return;

    if (!isParentOrSameFolder(homeDir.path, path)) {
      message.info(t(p("onlyHomeDir")));
      setPath(prevPath);
    }
  }, [homeDir, path]);

  useEffect(() => {
    if (!curDirContent) return;

    if (dirTree.length === 0) {
      setDirTree(convertToDirTree(curDirContent, path));
    } else {
      setDirTree(updateTreeData(dirTree, homeDir?.path || "~", path, curDirContent));
    }
  }, [curDirContent]);

  const onDirExpand = (expandDirs: Key[],
    { node, expanded }: { node: EventDataNode<DataNode>, expanded: boolean }) => {
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

  const onOkClick = () => {
    // 不选中文件夹的，直接把所在目录作为值
    if (!selectedFileInfo) {
      onSubmit(path);
      closeModal();
      return;
    }

    if (!checkFileSelectability(selectedFileInfo)) {
      message.info(t(p("notAllowed")));
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
    return allowedFileType.includes(fileInfo.type)
      && (allowedExtensions === undefined || allowedExtensions.includes(getExtension(fileInfo.name)));
  };

  return (
    <>
      <Button size="small" onClick={() => { setVisible(true); }}><FolderAddOutlined /></Button>
      <Modal
        width={1000}
        open={visible}
        onCancel={() => { closeModal(); }}
        title={t(p("select"))}
        centered
        footer={[
          <div key="footer" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
            <div key="left">
              <UploadFileButton
                path={path}
                clusterId={clusterId}
                reload={async () => {
                  await refetch();
                  setDirTree(updateTreeData(dirTree, homeDir?.path || "~", path, curDirContent ?? []));
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
                  setDirTree(updateTreeData(dirTree, homeDir?.path || "~", join(path, dirName), curDirContent ?? []));
                }}
              >
                {t(p("mkdir"))}
              </MkdirButton>
              <CompressionModalButton
                clusterId={clusterId}
                path={selectedKeys[0]?.toString()}
                reload={async () => {
                  await refetch();
                  setDirTree(updateTreeData(dirTree, homeDir?.path || "~", path, curDirContent ?? []));
                }}
              >
                {t(p("depression"))}
              </CompressionModalButton>
            </div>
            <div key="right">
              <Button key="cancel" onClick={() => { closeModal(); }}>{t("button.cancelButton")}</Button>
              <Button key="ok" type="primary" onClick={onOkClick}>{t("button.confirmButton")}</Button>
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
                index === 0
                  ? (
                    <Link
                      href=""
                      onClick={(e) => onClickLink(e, "/")}
                    ><DatabaseOutlined /></Link>
                  )
                  : (
                    <Link
                      href=""
                      onClick={(e) => onClickLink(e, curPath)}
                    >
                      {segment}
                    </Link>
                  )
              }
            />
          </TopBar>
          <div style={{ display: "flex", flexDirection: "row",
            width: "100%", alignItems: "flex-start" }}
          >
            <DirectoryTree
              style={{ width: 240, height: 541, overflow: "auto",
                border: "1px solid #e0e0e0", borderRadius: "5px" }}
              showLine
              selectedKeys={[path]}
              expandedKeys={expandedKeys}
              loadData={onLoadDir}
              onExpand={onDirExpand}
              treeData={dirTree}
            />
            <div style={{ width: "100%", overflowX: "auto", marginLeft: "6px",
              display: "flex", flex: 1, border: "1px solid #e0e0e0", borderRadius: "5px" }}
            >
              <FileTable
                style={{ flex: 1, overflowX: "auto" }}
                files={curDirContent || []}
                filesFilter={(files) => files.filter((file) => !file.name.startsWith("."))}
                loading={isDirContentLoading}
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

