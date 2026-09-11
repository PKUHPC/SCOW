import { EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import { FileBrowserLayout } from "@scow/lib-web/build/components/filemanager/FileBrowserLayout";
import { UpButtonBox } from "@scow/lib-web/build/components/filemanager/FileManagerLayout";
import { FileTableWrapper } from "@scow/lib-web/build/components/filemanager/FileTableWrapper";
import { PathBar } from "@scow/lib-web/build/components/filemanager/PathBar";
import { useAutoSelectSidebar } from "@scow/lib-web/build/hooks/useAutoSelectSidebar";
import { EntryPathIcon, ForwardIcon, HomeDirIcon } from "@scow/lib-web/build/icons/FileIcon";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { compareNumber } from "@scow/lib-web/build/utils/math";
import { buildEnrichedEntryPaths } from "@scow/lib-web/build/utils/storageClusterHelper";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Button, Space, Table, Tooltip } from "antd";
import { join } from "path";
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { SingleCrossClusterTransferSelector } from "src/pageComponents/filemanager/SingleCrossClusterTransferSelector";
import { FileInfo } from "src/pages/api/file/list";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { Cluster } from "src/utils/cluster";
import { FileInfoKey, fileInfoKey, nodeModeToString, openPreviewLink } from "src/utils/file";
import { iconFor } from "src/utils/file";
import { formatSize } from "src/utils/format";
import { styled } from "styled-components";

import { urlToDownload } from "./api";

const OperationBar = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0;

  .ant-btn,
  .ant-select,
  .ant-select-selector,
  .ant-input {
    height: 36px !important;
    border-radius: 4px !important;
  }

  .ant-btn {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }

  .ant-select-selector {
    display: flex !important;
    align-items: center !important;
    line-height: 34px !important;
  }

  .ant-select-arrow {
    top: 50% !important;
    transform: translateY(-50%);
    margin-top: 0 !important;
  }
`;

const TopBar = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  margin-bottom: 8px;

  .ant-btn,
  .ant-select,
  .ant-select-selector,
  .ant-input {
    height: 36px !important;
    border-radius: 4px !important;
  }

  .ant-btn {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }

  & > button {
    margin: 0px 4px;
  }
`;

const TransferFileTableWrapper = styled(FileTableWrapper)`
  .ant-table-cell {
    white-space: nowrap;
  }
`;

const p = prefix("pageComp.fileManagerComp.clusterFileTable.");
interface Props {
  selectedCluster?: Cluster;
  setSelectedCluster: (cluster: Cluster) => void;
  path: string;
  setPath: (path: string) => void;
  selectedKeys: FileInfoKey[];
  setSelectedKeys: (keys: FileInfoKey[]) => void;
  excludeCluster?: Cluster;
}

export const ClusterFileTable: React.FC<Props> = ({
  selectedCluster,
  setSelectedCluster,
  path,
  setPath,
  selectedKeys,
  setSelectedKeys,
  excludeCluster,
}) => {
  const setNewPath = (newPath: string) => {
    setPath(newPath);
    setSelectedKeys([]); // 每进入一个新的path，清空SelectedKeys
  };

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { user } = useStore(UserStore);
  const { fullClusterConfigs } = useStore(ClusterInfoStore);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [homePath, setHomePath] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showHiddenFile, setShowHiddenFile] = useState(false);

  const enrichedEntryPaths = useMemo(() => {
    if (!selectedCluster) return [];
    const clusterConfig = fullClusterConfigs[selectedCluster.id];
    return buildEnrichedEntryPaths(clusterConfig?.entryPaths, user?.identityId);
  }, [fullClusterConfigs, selectedCluster?.id, user?.identityId]);

  const selectedEntryIndex = useAutoSelectSidebar(path, homePath, enrichedEntryPaths);

  const onHiddenClick = () => {
    setShowHiddenFile(!showHiddenFile);
  };

  const reload = async () => {
    setLoading(true);
    // 清空SelectedKeys
    setSelectedKeys([]);
    if (selectedCluster) {
      await api
        .listFile({ query: { cluster: selectedCluster.id, path: path, updateAccessTime: true } })
        .then((d) => {
          setFiles(d.items);
        })
        .catch(() => {
          toHome();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [selectedCluster, path]);

  const up = () => {
    const paths = path.split("/");
    const newPath = paths.length === 1 ? path : paths.slice(0, paths.length - 1).join("/");
    setNewPath(newPath);
  };

  const toHome = async () => {
    if (selectedCluster) {
      await api.getHomeDirectory({ query: { cluster: selectedCluster.id } }).then((d) => {
        setHomePath(d.path);
        setNewPath(d.path);
      });
    }
  };

  const filteredFile = useMemo(() => {
    return files
      .filter((file) => showHiddenFile || !file.name.startsWith("."))
      .slice()
      .sort((a, b) =>
        a.type.localeCompare(b.type) === 0 ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type),
      );
  }, [files, showHiddenFile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <OperationBar>
        <Space wrap>
          <SingleCrossClusterTransferSelector
            value={selectedCluster}
            onChange={async (cluster) => {
              if (cluster) {
                await api.getHomeDirectory({ query: { cluster: cluster.id } }).then((d) => {
                  setHomePath(d.path);
                  setNewPath(d.path);
                  setSelectedCluster(cluster);
                });
              }
            }}
            exclude={excludeCluster}
          />
        </Space>
        <Space wrap>
          <Button onClick={onHiddenClick} icon={showHiddenFile ? <EyeInvisibleOutlined /> : <EyeOutlined />}>
            {showHiddenFile ? t(p("notShowHiddenItem")) : t(p("showHiddenItem"))}
          </Button>
        </Space>
      </OperationBar>
      <TopBar>
        <UpButtonBox
          $disabled={!selectedCluster}
          onClick={selectedCluster ? up : undefined}
          style={{ marginLeft: 0, marginRight: 8 }}
        >
          <ForwardIcon disabled={!selectedCluster} />
        </UpButtonBox>
        <PathBar
          path={path ?? ""}
          loading={loading}
          refreshPadding={12}
          onPathChange={(curPath) => {
            if (curPath === path) {
              reload();
            } else {
              setNewPath(curPath);
            }
          }}
          breadcrumbItemRender={(pathSegment, index, path) =>
            index === 0 ? null : (
              <a
                onClick={(e) => {
                  e.stopPropagation();
                  setNewPath(join("/", path));
                }}
              >
                {pathSegment}
              </a>
            )
          }
        />
      </TopBar>
      <FileBrowserLayout
        style={{ flex: 1, minHeight: 0 }}
        sidebarWidth={180}
        entries={[
          {
            key: "home",
            label: t(p("homeDirectory")),
            icon: <HomeDirIcon disabled={selectedEntryIndex !== "home"} />,
            selected: selectedEntryIndex === "home",
            disabled: !selectedCluster,
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
              setNewPath(entry.resolvedPath);
            },
          })),
        ]}
        collapsed={sidebarCollapsed}
        onCollapseToggle={() => setSidebarCollapsed((c) => !c)}
      >
        <TransferFileTableWrapper $fillHeight>
          <Table
            dataSource={filteredFile}
            loading={loading}
            pagination={false}
            size="small"
            tableLayout="fixed"
            scroll={{ x: 600 }}
            rowKey={(r) => fileInfoKey(r, path)}
            rowSelection={{
              columnWidth: 56,
              selectedRowKeys: selectedKeys,
              onChange: (keys) => {
                setSelectedKeys(keys);
              },
            }}
            onRow={(r) => ({
              onClick: () => {
                setSelectedKeys([fileInfoKey(r, path)]);
              },
              onDoubleClick: () => {
                if (r.type === "DIR") {
                  setNewPath(join(path, r.name));
                  // reload();
                } else if (r.type === "FILE") {
                  if (selectedCluster) {
                    const href = urlToDownload(selectedCluster.id, join(path, r.name), false);
                    openPreviewLink(href);
                  }
                }
              },
            })}
          >
            <Table.Column<FileInfo>
              dataIndex="type"
              title=""
              className="file-type-column"
              width={42}
              align="left"
              render={(_, r) => (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
                  {React.createElement(iconFor(r), {
                    style: { width: 18, height: 18, fontSize: 18 },
                  })}
                </span>
              )}
            />

            <Table.Column<FileInfo>
              dataIndex="name"
              title={t(p("fileName"))}
              width={150}
              ellipsis
              sorter={(a, b) => a.name.localeCompare(b.name)}
              sortDirections={["ascend", "descend"]}
              render={(_, r) =>
                r.type === "DIR" ? (
                  <a
                    title={r.name}
                    style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    onClick={(event) => {
                      event.stopPropagation(); // 阻止冒泡，防止点击文件夹进入新Path时选中
                      setNewPath(join(path, r.name));
                    }}
                  >
                    {r.name}
                  </a>
                ) : (
                  <a
                    title={r.name}
                    style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (selectedCluster) {
                        const href = urlToDownload(selectedCluster.id, join(path, r.name), false);
                        openPreviewLink(href);
                      }
                    }}
                  >
                    {r.name}
                  </a>
                )
              }
            />

            <Table.Column<FileInfo>
              dataIndex="mtime"
              title={t(p("modificationDate"))}
              width={155}
              render={(mtime: string | undefined) => {
                const formattedMtime = mtime ? formatDateTime(mtime) : "";
                return <span title={formattedMtime}>{formattedMtime}</span>;
              }}
              sorter={(a, b) =>
                a.type.localeCompare(b.type) === 0
                  ? compareDateTime(a.mtime, b.mtime) === 0
                    ? a.name.localeCompare(b.name)
                    : compareDateTime(a.mtime, b.mtime)
                  : a.type.localeCompare(b.type)
              }
            />

            <Table.Column<FileInfo>
              dataIndex="size"
              title={t(p("size"))}
              ellipsis
              width={90}
              render={(size: number | undefined, file: FileInfo) =>
                size === undefined || file.type === "DIR" ? (
                  ""
                ) : (
                  <Tooltip title={Math.round(size / 1024).toLocaleString() + "KB"} placement="topRight">
                    <span>{formatSize(Math.round(size / 1024))}</span>
                  </Tooltip>
                )
              }
              sorter={(a, b) => {
                return a.type.localeCompare(b.type) === 0
                  ? compareNumber(a.size, b.size) === 0
                    ? a.name.localeCompare(b.name)
                    : compareNumber(a.size, b.size)
                  : a.type.localeCompare(b.type);
              }}
            />

            <Table.Column<FileInfo>
              dataIndex="mode"
              title={t(p("permission"))}
              width={100}
              render={(mode: number | undefined) => {
                const formattedMode = mode === undefined ? "" : nodeModeToString(mode);
                return <span title={formattedMode}>{formattedMode}</span>;
              }}
            />
          </Table>
        </TransferFileTableWrapper>
      </FileBrowserLayout>
    </div>
  );
};
