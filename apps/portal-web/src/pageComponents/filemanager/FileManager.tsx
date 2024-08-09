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
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Divider, Space } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
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
import { FileEditModal } from "src/pageComponents/filemanager/FileEditModal";
import { FileTable } from "src/pageComponents/filemanager/FileTable";
import { ImagePreviewer } from "src/pageComponents/filemanager/ImagePreviewer";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { PathBar } from "src/pageComponents/filemanager/PathBar";
import { RenameModal } from "src/pageComponents/filemanager/RenameModal";
import { UploadModal } from "src/pageComponents/filemanager/UploadModal";
import { FileInfo } from "src/pages/api/file/list";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { convertToBytes } from "src/utils/format";
import { canPreviewWithEditor, isImage } from "src/utils/staticFiles";
import { styled } from "styled-components";

interface Props {
  cluster: Cluster;
  path: string;
  urlPrefix: string;
  scowdEnabled: boolean;
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

const DEFAULT_FILE_PREVIEW_LIMIT_SIZE = "50m";

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

export const FileManager: React.FC<Props> = ({ cluster, path, urlPrefix, scowdEnabled }) => {

  const router = useRouter();

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

  const [previewFile, setPreviewFile] = useState({
    open: false,
    filename: "",
    fileSize: 0,
    filePath: "",
    clusterId: "",
  });
  const [previewImage, setPreviewImage] = useState({
    visible: false,
    src: "",
    scaleStep: 0.5,
  });

  const [operation, setOperation] = useState<Operation | undefined>(undefined);
  const [showHiddenFile, setShowHiddenFile] = useState(false);

  const { loginNodes } = useStore(LoginNodeStore);
  const loginNode = loginNodes[cluster.id][0].address;

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

    router.push(fullUrl(newPath));
  };

  const toHome = () => {
    router.push(fullUrl("~"));
  };

  const back = () => {
    router.back();
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
          router.push(fullUrl(prevPathRef.current));
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
          await new Promise<void>((res) => {
            modal.confirm({
              title: t(p("moveCopy.existModalTitle")),
              content: t(p("moveCopy.existModalContent"), [x.name]),
              okText: t(p("moveCopy.existModalOk")),
              onOk: async () => {
                const fileType = await api.getFileType({ query: { cluster: cluster.id, path: join(path, x.name) } });
                const deleteOperation = fileType.type === "dir" ? api.deleteDir : api.deleteFile;
                await deleteOperation({ query: { cluster: cluster.id, path: join(path, x.name) } });
                await pasteFile(x, join(operation.originalPath, x.name), join(path, x.name));
                successfulCount++;
                res();
              },
              onCancel: async () => { abandonCount++; res(); },
            });
          });
        } else {
          await pasteFile(x, join(operation.originalPath, x.name), join(path, x.name));
          successfulCount++;
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
              message.error(t(p("delete.errorMessage"), [(allCount - failedCount), failedCount]));
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

  const handlePreview = (filename: string, fileSize: number) => {

    const filePreviewLimitSize = publicConfig.FILE_PREVIEW_SIZE || DEFAULT_FILE_PREVIEW_LIMIT_SIZE;
    if (fileSize > convertToBytes(filePreviewLimitSize)) {
      message.info(t(p("preview.cantPreview"), [filePreviewLimitSize]));
      return;
    }

    if (isImage(filename)) {
      setPreviewImage({
        ...previewImage,
        visible: true,
        src: urlToDownload(cluster.id, join(path, filename), false),
      });
      return;
    } else if (canPreviewWithEditor(filename)) {
      setPreviewFile({
        open: true,
        filename,
        fileSize: fileSize,
        filePath: join(path, filename),
        clusterId: cluster.id,
      });
      return;
    } else {
      message.info(t(p("preview.cantPreview"), [filePreviewLimitSize]));
      return;
    }
  };

  const editFile = queryToString(router.query.edit);

  useEffect(() => {
    if (editFile !== "") {
      const foundFile = files.find((file) => file.name === editFile);
      if (foundFile && foundFile.type !== "DIR") {
        handlePreview(editFile, foundFile.size);
      }
    }
  }, [editFile, files]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    const uploadQuery = queryToString(router.query.uploadModalOpen);
    if (uploadQuery === "true") {
      setIsUploadModalOpen(true);
    } else {
      setIsUploadModalOpen(false);
    }
  }, []);


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
          onPathChange={(curPath) => {
            if (curPath === path) {
              reload();
            } else {
              router.push(fullUrl(curPath));
            }
          }}
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
            externalOpen={isUploadModalOpen}
            cluster={cluster.id}
            path={path}
            reload={reload}
            scowdEnabled={scowdEnabled}
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
            {showHiddenFile ? t(p("tableInfo.notShowHiddenItem")) : t(p("tableInfo.showHiddenItem"))}
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
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
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
            if (!loading && r.type === "DIR") {
              setLoading(true);
              router.push(fullUrl(join(path, r.name)));
            } else if (r.type === "FILE") {
              handlePreview(r.name, r.size);
            }
          },
        })}
        fileNameRender={(_, r) => (
          r.type === "DIR" ? (
            <a onClick={() => {
              if (!loading) {
                setLoading(true);
                router.push(fullUrl(join(path, r.name)));
              }
            }}
            >
              {r.name}
            </a>
          ) : (
            <a onClick={() => {
              handlePreview(r.name, r.size);
            }}
            >
              {r.name}
            </a>
          )
        )}
        actionRender={(_, i: FileInfo) => (
          <Space>
            {
              i.type === "FILE" && (
                <a href={urlToDownload(cluster.id, join(path, i.name), true)}>
                  {t(p("tableInfo.download"))}
                </a>
              )
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
            {
              i.type === "FILE" ? (
                <a onClick={() => {
                  const fullPath = join(path, i.name);
                  modal.confirm({
                    title: t(p("tableInfo.submitConfirmTitle")),
                    content: (
                      <>
                        <p>{t(p("tableInfo.submitConfirmNotice"))}</p>
                        <p>
                          {t(p("tableInfo.submitConfirmContent"),
                            [i.name, getI18nConfigCurrentText(cluster.name, languageId)])}
                        </p>
                      </>
                    ),
                    okText: t(p("tableInfo.submitConfirmOk")),
                    onOk: async () => {
                      await api.submitFileAsJob({
                        body: {
                          cluster: cluster.id,
                          filePath: fullPath,
                        },
                      })
                        .httpError(500, (e) => {
                          if (e.code === "SCHEDULER_FAILED" || e.code === "FAILED_PRECONDITION"
                            || e.code === "UNIMPLEMENTED") {
                            modal.error({
                              title: t(p("tableInfo.submitFailedMessage")),
                              content: e.message,
                            });
                          } else {
                            message.error(e.message);
                            throw e;
                          }
                        })
                        .httpError(400, (e) => {
                          if (e.code === "INVALID_ARGUMENT" || e.code === "INVALID_PATH") {
                            modal.error({
                              title: t(p("tableInfo.submitFailedMessage")),
                              content: e.message,
                            });
                          } else {
                            message.error(e.message);
                            throw e;
                          }
                        })
                        .then((result) => {
                          message.success(t(p("tableInfo.submitSuccessMessage"), [result.jobId]));
                          resetSelectedAndOperation();
                          reload();
                        });
                    },
                  });
                }}
                >
                  {t("button.submitButton")}
                </a>
              ) : undefined
            }
          </Space>
        )}
      />
      <ImagePreviewer previewImage={previewImage} setPreviewImage={setPreviewImage} />
      <FileEditModal previewFile={previewFile} setPreviewFile={setPreviewFile} />
    </div>
  );
};


const RenameLink = ModalLink(RenameModal);
const CreateFileButton = ModalButton(CreateFileModal, { icon: <FileAddOutlined /> });
const MkdirButton = ModalButton(MkdirModal, { icon: <FolderAddOutlined /> });
const UploadButton = ModalButton(UploadModal, { icon: <UploadOutlined /> });

// function openPreviewLink(href: string) {
//   window.open(href, "ViewFile", "location=yes,resizable=yes,scrollbars=yes,status=yes");
// }
