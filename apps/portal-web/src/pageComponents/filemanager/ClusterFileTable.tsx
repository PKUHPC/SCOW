import { DatabaseOutlined, EyeInvisibleOutlined, EyeOutlined, HomeOutlined, UpOutlined } from "@ant-design/icons";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { compareNumber } from "@scow/lib-web/build/utils/math";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Button, Space, Table, Tooltip } from "antd";
import { join } from "path";
import React, { useEffect, useMemo, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { SingleCrossClusterTransferSelector } from "src/pageComponents/filemanager/SingleCrossClusterTransferSelector";
import { FileInfo } from "src/pages/api/file/list";
import { Cluster } from "src/utils/cluster";
import { FileInfoKey, fileInfoKey, nodeModeToString, openPreviewLink, TopBar } from "src/utils/file";
import { iconFor } from "src/utils/file";
import { formatSize } from "src/utils/format";
import { styled } from "styled-components";

import { urlToDownload } from "./api";
import { PathBar } from "./PathBar";

const OperationBar = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 4px;
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

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showHiddenFile, setShowHiddenFile] = useState(false);

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
        setNewPath(d.path);
      });
    }
  };

  const filteredFile = useMemo(() => {
    return files.filter((file) => showHiddenFile || !file.name.startsWith("."));
  }, [files, showHiddenFile]);

  return (
    <>
      <OperationBar>
        <Space wrap>
          <SingleCrossClusterTransferSelector
            value={selectedCluster}
            onChange={async (cluster) => {
              if (cluster) {
                await api.getHomeDirectory({ query: { cluster: cluster.id } }).then((d) => {
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
        <Button disabled={!selectedCluster} onClick={toHome} icon={<HomeOutlined />} shape="circle" />
        <Button disabled={!selectedCluster} onClick={up} icon={<UpOutlined />} shape="circle" />
        <PathBar
          path={path ?? ""}
          loading={loading}
          onPathChange={(curPath) => {
            if (curPath === path) {
              reload();
            } else {
              setNewPath(curPath);
            }
          }}
          breadcrumbItemRender={(pathSegment, index, path) =>
            index === 0 ? (
              <DatabaseOutlined onClick={toHome} />
            ) : (
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
      <Table
        dataSource={filteredFile}
        loading={loading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
        size="small"
        rowKey={(r) => fileInfoKey(r, path)}
        scroll={{ x: true }}
        rowSelection={{
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
          width={"32px"}
          defaultSortOrder={"ascend"}
          sorter={(a, b) => a.type.localeCompare(b.type)}
          render={(_, r) => React.createElement(iconFor(r))}
        />

        <Table.Column<FileInfo>
          dataIndex="name"
          title={t(p("fileName"))}
          sorter={(a, b) => a.name.localeCompare(b.name)}
          sortDirections={["ascend", "descend"]}
          render={(_, r) =>
            r.type === "DIR" ? (
              <a
                onClick={(event) => {
                  event.stopPropagation(); // 阻止冒泡，防止点击文件夹进入新Path时选中
                  setNewPath(join(path, r.name));
                }}
              >
                {r.name}
              </a>
            ) : (
              <a
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
          render={(mtime: string | undefined) => (mtime ? formatDateTime(mtime) : "")}
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
          render={(mode: number | undefined) => (mode === undefined ? "" : nodeModeToString(mode))}
        />
      </Table>
    </>
  );
};
