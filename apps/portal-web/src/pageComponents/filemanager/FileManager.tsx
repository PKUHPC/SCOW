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

import {
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined, EyeInvisibleOutlined,
  EyeOutlined, FileAddOutlined, FolderAddOutlined,
  HomeOutlined, LeftOutlined, MacCommandOutlined, RightOutlined,
  ScissorOutlined, SnippetsOutlined, UploadOutlined, UpOutlined,
} from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/i18n";
import { App, Button, Divider, Space } from "antd";
import Link from "next/link";
import Router from "next/router";
import { join } from "path";
import React, { useEffect, useRef, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis/api";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { urlToDownload } from "src/pageComponents/filemanager/api";
import { CreateFileModal } from "src/pageComponents/filemanager/CreateFileModal";
import { FileTable } from "src/pageComponents/filemanager/FileTable";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { PathBar } from "src/pageComponents/filemanager/PathBar";
import { RenameModal } from "src/pageComponents/filemanager/RenameModal";
import { UploadModal } from "src/pageComponents/filemanager/UploadModal";
import { FileInfo } from "src/pages/api/file/list";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { Cluster, publicConfig } from "src/utils/config";
import styled from "styled-components";

interface Props {
  cluster: Cluster;
  path: string;
  urlPrefix: string;
}

interface PromiseSettledResult {
  status: string;
  value?: FileInfo | undefined;
}

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

type FileInfoKey = React.Key;

const fileInfoKey = (f: FileInfo, path: string): FileInfoKey => join(path, f.name);

interface Operation {
  op: "copy" | "move";
  originalPath: string
  started: boolean;
  selected: FileInfo[];
  completed: FileInfo[];
}

const p = prefix("pageComp.fileManagerComp.fileManager.");

export const FileManager: React.FC<Props> = ({ cluster, path, urlPrefix }) => {


  const t = useI18nTranslateToString();

  const operationTexts = {
    copy: t(p("moveCopy.copy")),
    move: t(p("moveCopy.move")),
  };

  const { message, modal } = App.useApp();

  const languageId = useI18n().currentLanguage.id;

  const prevPathRef = useRef<string>(path);

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<FileInfoKey[]>([]);

  const [operation, setOperation] = useState<Operation | undefined>(undefined);
  const [showHiddenFile, setShowHiddenFile] = useState(false);

  const { loginNodes } = useStore(LoginNodeStore);
  const loginNode = loginNodes[cluster.id][0].name;

  const reload = async (signal?: AbortSignal) => {
    setLoading(true);
    await api.listFile({ query: { cluster: cluster.id, path } }, signal)
      .then((d) => {
        setFiles(d.items);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fullUrl = (path: string) => join(urlPrefix, cluster.id, path);

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

    const operationText = operationTexts[operation.op];

    setOperation({ ...operation, started: true });

    const operationApi = operation.op === "copy" ? api.copyFileItem : api.moveFileItem;

    const pasteFile = async (file: FileInfo, fromPath: string, toPath: string) => {
      await operationApi({ body: { cluster: cluster.id, fromPath, toPath } })
        .httpError(415, ({ error }) => {
          modal.error({
            title: t(p("moveCopy.modalErrorTitle"), [file.name, operationText]),
            content: error,
          });
          throw error;
        })
        .then(() => {
          setOperation((o) => o ? { ...operation, completed: o.completed.concat(file) } : undefined);
          return file;
        }).catch((e) => {
          throw e;
        });
    };

    let successfulCount: number = 0;
    let abandonCount: number = 0;
    const allCount = operation.selected.length;
    for (const x of operation.selected) {
      try {

        const exists = await api.fileExist({ query: { cluster: cluster.id, path: join(path, x.name) } });
        if (exists.result) {
          await new Promise<void>(async (res) => {
            modal.confirm({
              title: t(p("moveCopy.existModalTitle")),
              content: t(p("moveCopy.existModalContent"), [x.name]),
              okText: t(p("moveCopy.existModalOk")),
              onOk: async () => {
                const fileType = await api.getFileType({ query: { cluster: cluster.id, path: join(path, x.name) } });
                const deleteOperation = fileType.type === "dir" ? api.deleteDir : api.deleteFile;
                await deleteOperation({ query: { cluster: cluster.id, path: join(path, x.name) } });
                try {
                  await pasteFile(x, join(operation.originalPath, x.name), join(path, x.name));
                  successfulCount++;
                } catch (e) {
                  throw e;
                }
                res();
              },
              onCancel: async () => { abandonCount++; res(); },
            });
          });
        } else {
          try {
            await pasteFile(x, join(operation.originalPath, x.name), join(path, x.name));
            successfulCount++;
          } catch (e) {
            throw e;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (allCount - successfulCount - abandonCount) {
      message.error(
        t(p("moveCopy.errorMessage"),
          [operationText, allCount, successfulCount, abandonCount, (allCount - successfulCount - abandonCount)]),
      );
    } else {
      message.success(
        t(p("moveCopy.successMessage"), [operationText, allCount, successfulCount, abandonCount]),
      );
    }

    resetSelectedAndOperation();
    reload();
  };

  const onDeleteClick = () => {
    const files = keysToFiles(selectedKeys);
    modal.confirm({
      title: t(p("delete.confirmTitle")),
      okText: t(p("delete.confirmOk")),
      content: t(p("delete.confirmContent"), [files.length]),
      onOk: async () => {
        await Promise.allSettled(files.map(async (x) => {
          return (x.type === "FILE" ? api.deleteFile : api.deleteDir)({
            query: {
              cluster: cluster.id,
              path: join(path, x.name),
            },
          }).then(() => x).catch(() => undefined);
        }))
          .then((successfulInfo) => {
            const failedCount = successfulInfo.filter((x: PromiseSettledResult) =>
              (!x || x.status === "rejected" || !x.value)).length;
            const allCount = files.length;
            if (failedCount === 0) {
              message.success(t(p("delete.successMessage"), [allCount]));
              resetSelectedAndOperation();
            } else {
              // message.error(`删除成功${allCount - failedCount}项，失败${failedCount}项`);
              message.error(t(p("delete.errorMessage"), [(allCount - failedCount), failedCount])),
              setOperation((o) => o && ({ ...o, started: false }));
            }
          }).catch((e) => {
            console.log(e);
            message.error(t(p("delete.otherErrorMessage")));
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

  const onHiddenClick = () => {
    setShowHiddenFile(!showHiddenFile);
  };

  return (
    <div>
      <TitleText>
        <span>
          {t(p("tableInfo.title"), [getI18nConfigCurrentText(cluster.name, languageId)])}
        </span>
      </TitleText>
      <TopBar>
        <Button onClick={back} icon={<LeftOutlined />} shape="circle" />
        <Button onClick={forward} icon={<RightOutlined />} shape="circle" />
        <Button onClick={toHome} icon={<HomeOutlined />} shape="circle" />
        <Button onClick={up} icon={<UpOutlined />} shape="circle" />
        <PathBar
          path={path}
          loading={loading}
          onPathChange={(curPath) => { curPath === path ? reload() : Router.push(fullUrl(curPath)); }}
          breadcrumbItemRender={(pathSegment, index, path) =>
            (index === 0 ? (
              <Link href={fullUrl("/")} title="/" onClick={(e) => e.stopPropagation()}>
                <DatabaseOutlined />
              </Link>
            ) : (
              <Link
                href={fullUrl(path)}
                key={index}
                onClick={(e) => e.stopPropagation()}
              >
                {pathSegment}
              </Link>
            ))
          }
        />
      </TopBar>
      <OperationBar>
        <Space wrap>
          <UploadButton
            cluster={cluster.id}
            path={path}
            reload={reload}
          >
            {t(p("tableInfo.uploadButton"))}
          </UploadButton>
          <Divider type="vertical" />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={onDeleteClick}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("tableInfo.deleteSelected"))}
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() =>
              setOperation({
                op: "copy",
                selected: keysToFiles(selectedKeys), originalPath: path, started: false, completed: [],
              })}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("tableInfo.copySelected"))}
          </Button>
          <Button
            icon={<ScissorOutlined />}
            onClick={() =>
              setOperation({
                op: "move",
                selected: keysToFiles(selectedKeys), originalPath: path, started: false, completed: [],
              })}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("tableInfo.moveSelected"))}
          </Button>
          <Button
            icon={<SnippetsOutlined />}
            onClick={paste}
            disabled={!operation || operation.started || operation.originalPath === path}
          >
            {t(p("tableInfo.paste"))}
          </Button>
          {
            operation ? (
              operation.started ? (
                <span>
                  {t(p("tableInfo.operationStarted"), [operationTexts[operation.op]])} +
                  {`${operation.completed.length} / ${operation.selected.length}`}
                </span>
              ) : (
                <span>
                  {t(p("tableInfo.operationNotStarted"), [operationTexts[operation.op], operation.selected.length])}
                  <a onClick={() => setOperation(undefined)} style={{ marginLeft: "4px" }}>
                    {t("button.cancelButton")}
                  </a>
                </span>
              )) : ""
          }
        </Space>
        <Space wrap>
          <Button
            onClick={onHiddenClick}
            icon={showHiddenFile ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          >
            {showHiddenFile ? t(p("tableInfo.hidden")) : t(p("tableInfo.notHidden"))}{t(p("tableInfo.hiddenItem"))}
          </Button>
          {
            publicConfig.ENABLE_SHELL ? (
              <Link href={`/shell/${cluster.id}/${loginNode}${path}`} target="_blank">
                <Button icon={<MacCommandOutlined />}>
                  {t(p("tableInfo.openInShell"))}
                </Button>
              </Link>
            ) : null
          }
          <CreateFileButton
            cluster={cluster.id}
            path={path}
            reload={reload}
          >
            {t(p("tableInfo.createFile"))}
          </CreateFileButton>
          <MkdirButton
            cluster={cluster.id}
            path={path}
            reload={reload}
          >
            {t(p("tableInfo.mkDir"))}
          </MkdirButton>
        </Space>
      </OperationBar>
      <FileTable
        files={files}
        filesFilter={(files) => files.filter((file) => showHiddenFile || !file.name.startsWith("."))}
        loading={loading}
        scroll={{ x: true }}
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
              Router.push(fullUrl(join(path, r.name)));
            } else if (r.type === "FILE") {
              const href = urlToDownload(cluster.id, join(path, r.name), false);
              openPreviewLink(href);
            }
          },
        })}
        fileNameRender={(_, r) => (
          r.type === "DIR" ? (
            <Link href={join(urlPrefix, cluster.id, path, r.name)} passHref>
              {r.name}
            </Link>
          ) : (
            <a onClick={() => {
              const href = urlToDownload(cluster.id, join(path, r.name), false);
              openPreviewLink(href);
            }}
            >
              {r.name}
            </a>
          )
        )}
        actionRender={(_, i: FileInfo) => (
          <Space>
            {
              i.type === "FILE" ? (
                <a href={urlToDownload(cluster.id, join(path, i.name), true)}>
                  {t(p("tableInfo.download"))}
                </a>
              ) : undefined
            }
            <RenameLink
              cluster={cluster.id}
              path={join(path, i.name)}
              reload={reload}
            >
              {t(p("tableInfo.rename"))}
            </RenameLink>
            <a onClick={() => {
              const fullPath = join(path, i.name);
              modal.confirm({
                title: t(p("tableInfo.deleteConfirmTitle")),
                // icon: < />,
                content: t(p("tableInfo.deleteConfirmContent"), [fullPath]),
                okText: t(p("tableInfo.deleteConfirmOk")),
                onOk: async () => {
                  await (i.type === "FILE" ? api.deleteFile : api.deleteDir)({
                    query: {
                      cluster: cluster.id,
                      path: fullPath,
                    },
                  })
                    .then(() => {
                      message.success(t(p("tableInfo.deleteSuccessMessage")));
                      resetSelectedAndOperation();
                      reload();
                    });
                },
              });
            }}
            >
              {t("button.deleteButton")}
            </a>
          </Space>
        )}
      />
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