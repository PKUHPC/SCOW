import { CloseOutlined,
  CopyOutlined,
  DeleteOutlined, FileAddOutlined, FileOutlined, FolderAddOutlined,
  FolderOutlined,   HomeOutlined, LeftOutlined, MacCommandOutlined, RightOutlined,
  ScissorOutlined, SnippetsOutlined, UploadOutlined, UpOutlined } from "@ant-design/icons";
import { Button, Divider, message, Modal, Space, Table } from "antd";
import Link from "next/link";
import Router from "next/router";
import { join } from "path";
import React, { useEffect, useRef, useState } from "react";
import { api } from "src/apis/api";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { TableTitle } from "src/components/TableTitle";
import { urlToDownload } from "src/pageComponents/filemanager/api";
import { CreateFileModal } from "src/pageComponents/filemanager/CreateFileModal";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { PathBar } from "src/pageComponents/filemanager/PathBar";
import { RenameModal } from "src/pageComponents/filemanager/RenameModal";
import { UploadModal } from "src/pageComponents/filemanager/UploadModal";
import { FileInfo, FileType } from "src/pages/api/file/list";
import { CLUSTERS, publicConfig } from "src/utils/config";
import { compareDateTime, formatDateTime } from "src/utils/datetime";
import { compareNumber } from "src/utils/math";
import styled from "styled-components";

interface Props {
  cluster: string;
  path: string;
  urlPrefix: string;
}

const fileTypeIcons = {
  "file": FileOutlined,
  "dir": FolderOutlined,
  "error": CloseOutlined,
} as Record<FileType, React.ComponentType>;

const TopBar = styled(FilterFormContainer)`
  display: flex;
  flex-direction: row;
  padding-bottom: 8px;

  &>button {
    margin: 0px 4px;
  }
`;

const OperationBar = styled(TableTitle)`
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
`;

const nodeModeToString = (mode: number) => {
  const numberPermission = (mode & parseInt("777", 8)).toString(8);

  const toStr = (char: string) => {
    const num = +char;
    return ((num & 4) !== 0 ? "r" : "-") + ((num & 2) !== 0 ? "w" : "-") + ((num & 1) !== 0 ? "x" : "-");
  };

  return [0, 1, 2].reduce((prev, curr) => prev + toStr(numberPermission[curr]), "");
};

type FileInfoKey = React.Key;

const fileInfoKey = (f: FileInfo, path: string): FileInfoKey => join(path, f.name);

interface Operation {
  op: "copy" | "move";
  originalPath: string
  started: boolean;
  selected: FileInfo[];
  completed: FileInfo[];
}

const operationTexts = {
  copy: "??????",
  move: "??????",
};

export const FileManager: React.FC<Props> = ({ cluster, path, urlPrefix }) => {

  const prevPathRef = useRef<string>(path);

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<FileInfoKey[]>([]);

  const [operation, setOperation] = useState<Operation | undefined>(undefined);

  const reload = async (signal?: AbortSignal) => {
    setLoading(true);
    await api.listFile({ query: { cluster, path } }, signal)
      .then((d) => {
        setFiles(d.items);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fullUrl = (path: string) => join(urlPrefix, cluster, path);

  const up = () => {
    const paths = path.split("/");

    const newPath = paths.length === 1
      ? path : "/" + paths.slice(0, paths.length - 1).join("/");

    Router.push(fullUrl(newPath));
  };

  const toHome = () => {
    Router.push(fullUrl("~"));
  };

  const back = () => {
    Router.back();
  };

  const forward = () => {
    history.forward();
  };


  useEffect(() => {
    if (path === "~") {
      return;
    }

    setSelectedKeys([]);

    reload()
      .then(() => { prevPathRef.current = path; })
      .catch(() => {
        if (prevPathRef.current !== path) {
          Router.push(fullUrl(prevPathRef.current));
        }
      });
  }, [path]);

  const resetSelectedAndOperation = () => {
    setSelectedKeys([]);
    setOperation(undefined);
  };


  const paste = async () => {
    if (!operation) { return; }

    setOperation({ ...operation, started: true });

    await Promise.allSettled(operation.selected.map(async (x) => {
      return await (operation.op === "copy" ? api.copyFileItem : api.moveFileItem)({
        body: {
          cluster,
          fromPath: join(operation.originalPath, x.name),
          toPath: join(path, x.name),
        },
      }).then(() => {
        setOperation((o) => o ? { ...operation, completed: o.completed.concat(x) } : undefined);
        return x;
      }).catch(() => {
        return undefined;
      });
    }))
      .then((successfulInfo) => {
        const successfulCount = successfulInfo.filter((x) => x).length;
        const allCount = operation.selected.length;
        if (successfulCount === allCount) {
          message.success(`${operationTexts[operation.op]}${allCount}????????????`);
          resetSelectedAndOperation();
        } else {
          message.error(`${operationTexts[operation.op]}??????${successfulCount}????????????${allCount - successfulCount}???`);
          setOperation((o) => o && ({ ...o, started: false }));
        }
      }).catch((e) => {
        console.log(e);
        message.error(`??????${operationTexts[operation.op]}?????????????????????`);
        setOperation((o) => o && ({ ...o, started: false }));
      }).finally(() => {
        reload();
      });

  };

  const onDeleteClick = () => {
    const files = keysToFiles(selectedKeys);
    Modal.confirm({
      title: "????????????",
      content: `????????????????????????${files.length}??????`,
      onOk: async () => {
        await Promise.allSettled(files.map(async (x) => {
          return (x.type === "file" ? api.deleteFile : api.deleteDir)({
            body: {
              cluster,
              path: join(path, x.name),
            },
          }).then(() => x).catch(() => undefined);
        }))
          .then((successfulInfo) => {
            const failedCount = successfulInfo.filter((x) => !x).length;
            const allCount = files.length;
            if (failedCount === 0) {
              message.success(`??????${allCount}????????????`);
              resetSelectedAndOperation();
            } else {
              message.error(`????????????${allCount - failedCount}????????????${failedCount}???`);
              setOperation((o) => o && ({ ...o, started: false }));
            }
          }).catch((e) => {
            console.log(e);
            message.error("?????????????????????????????????");
            setOperation((o) => o && ({ ...o, started: false }));
            setSelectedKeys([]);
          }).finally(() => {
            setOperation(undefined);
            reload();
          });
      },
    });

  };

  const keysToFiles = (keys: React.Key[]) => {
    return files.filter((x) => keys.includes(fileInfoKey(x, path)));
  };

  return (
    <div>
      <TitleText>
        ??????{CLUSTERS[cluster] ?? cluster}????????????
      </TitleText>
      <TopBar>
        <Button onClick={back} icon={<LeftOutlined />} shape="circle" />
        <Button onClick={forward} icon={<RightOutlined />} shape="circle" />
        <Button onClick={toHome} icon={<HomeOutlined />} shape="circle" />
        <Button onClick={up} icon={<UpOutlined />} shape="circle" />
        <PathBar
          path={path}
          reload={reload}
          go={(path) => Router.push(fullUrl(path))}
          loading={loading}
          fullUrl={fullUrl}
        />
      </TopBar>
      <OperationBar>
        <Space wrap>
          <UploadButton
            cluster={cluster}
            path={path}
            reload={reload}
          >
            ????????????
          </UploadButton>
          <Divider type="vertical" />
          <Button icon={<DeleteOutlined />} danger onClick={onDeleteClick}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            ????????????
          </Button>
          <Button
            icon={<CopyOutlined />} onClick={() =>
              setOperation({ op: "copy",
                selected: keysToFiles(selectedKeys), originalPath: path, started: false, completed: [],
              })}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            ????????????
          </Button>
          <Button icon={<ScissorOutlined />} onClick={() =>
            setOperation({ op:"move",
              selected: keysToFiles(selectedKeys), originalPath: path, started: false, completed: []})}
          disabled={selectedKeys.length === 0 || operation?.started}
          >
            ????????????
          </Button>
          <Button icon={<SnippetsOutlined />} onClick={paste}
            disabled={!operation || operation.started || operation.originalPath === path}
          >
            ???????????????
          </Button>
          {
            operation ? (
              operation.started ? (
                <span>
                  {`??????${operationTexts[operation.op]}???` +
                  `????????????${operation.completed.length} / ${operation.selected.length}`}
                </span>
              ) : (
                <span>
                  {`?????????${operationTexts[operation.op]}${operation.selected.length}??????`}
                  <a onClick={() => setOperation(undefined)} style={{ marginLeft: "4px" }}>
                  ??????
                  </a>
                </span>
              )) : ""
          }
        </Space>
        <Space wrap>
          {
            publicConfig.ENABLE_SHELL ? (
              <a href={`/shell/${cluster}${path}`} target="_blank" rel="noreferrer">
                <Button icon={<MacCommandOutlined />}>
                  ??????????????????
                </Button>
              </a>
            ) : null
          }
          <CreateFileButton
            cluster={cluster}
            path={path}
            reload={reload}
          >
            ?????????
          </CreateFileButton>
          <MkdirButton
            cluster={cluster}
            path={path}
            reload={reload}
          >
            ?????????
          </MkdirButton>
        </Space>
      </OperationBar>
      <Table
        dataSource={files}
        loading={loading}
        pagination={false}
        size="small"
        rowKey={(r) => fileInfoKey(r, path)}
        scroll={{ x: true }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
        }}
        onRow={(r) => ({
          onClick: () => {
            setSelectedKeys([fileInfoKey(r, path)]);
          },
          onDoubleClick: () => {
            if (r.type === "dir") {
              Router.push(fullUrl(join(path, r.name)));
            } else if (r.type === "file") {
              const href = urlToDownload(cluster, join(path, r.name), false);
              openPreviewLink(href);
            }
          },
        })}
      >
        <Table.Column<FileInfo> dataIndex="type" title=""
          width="32px"
          defaultSortOrder={"ascend"}
          sorter={(a, b) => a.type.localeCompare(b.type)}
          sortDirections={["ascend", "descend"]}
          render={(_, r) => (
            React.createElement(fileTypeIcons[r.type])
          )}
        />

        <Table.Column<FileInfo> dataIndex="name" title="?????????"
          sorter={(a, b) => a.name.localeCompare(b.name)}
          sortDirections={["ascend", "descend"]}
          render={(_, r) => (
            r.type === "dir" ? (
              <Link href={join(urlPrefix, cluster, path, r.name)} passHref>
                <a>{r.name}</a>
              </Link>
            ) : (
              <a onClick={() => {
                const href = urlToDownload(cluster, join(path, r.name), false);
                openPreviewLink(href);
              }}
              >
                {r.name}
              </a>
            )
          )}
        />

        <Table.Column<FileInfo> dataIndex="mtime" title="????????????"
          render={(mtime: string | undefined) => mtime ? formatDateTime(mtime) : ""}
          sorter={(a, b) => compareDateTime(a.mtime, b.mtime) }
        />

        <Table.Column<FileInfo> dataIndex="size" title="??????"
          render={(size: number | undefined) => size === undefined ? "" : Math.floor(size / 1024) + " KB"}
          sorter={(a, b) => compareNumber(a.size, b.size) }
        />

        <Table.Column<FileInfo> dataIndex="mode" title="??????"
          render={(mode: number | undefined) => mode === undefined ? "" : nodeModeToString(mode)}
        />

        <Table.Column<FileInfo> dataIndex="action" title="??????"
          render={(_, i: FileInfo) => (
            <Space>
              {
                i.type === "file" ? (
                  <a href={urlToDownload(cluster, join(path, i.name), true)}>
                ??????
                  </a>
                ) : undefined
              }
              <RenameLink
                cluster={cluster}
                path={join(path, i.name)}
                reload={reload}
              >
                ?????????
              </RenameLink>
              <a onClick={() => {
                const fullPath = join(path, i.name);
                Modal.confirm({
                  title: "????????????",
                  // icon: < />,
                  content: `????????????${fullPath}???`,
                  onOk: async () => {
                    await (i.type === "file" ? api.deleteFile : api.deleteDir)({
                      body: {
                        cluster,
                        path: fullPath,
                      },
                    })
                      .then(() => {
                        message.success("???????????????");
                        resetSelectedAndOperation();
                        reload();
                      });
                  },
                });
              }}
              >
                ??????
              </a>
            </Space>
          )}
        />

      </Table>
    </div>
  );
};

const RenameLink = ModalLink(RenameModal);
const CreateFileButton = ModalButton(CreateFileModal, { icon: <FileAddOutlined /> });
const MkdirButton = ModalButton(MkdirModal, { icon: <FolderAddOutlined /> });
const UploadButton = ModalButton(UploadModal, { icon: <UploadOutlined /> });


function openPreviewLink(href: string) {
  window.open(href, "ViewFile", "location=yes,resizable=yes,scrollbars=yes,status=yes");
}
