import { CopyOutlined, DatabaseOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeOutlined,
  FileAddOutlined, FolderAddOutlined, HomeOutlined, ScissorOutlined, SnippetsOutlined, UploadOutlined,
  UpOutlined } from "@ant-design/icons";
import { canPreviewWithEditor, isImage } from "@scow/lib-web/build/utils/staticFiles";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import type { inferRouterOutputs } from "@trpc/server";
import { App, Button, Divider, Modal, Space } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { join } from "path";
import React, { useEffect, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useOperation } from "src/app/(auth)/files/[cluster]/context";
import { FileEditModal } from "src/components/FileEditModal";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ImagePreviewer } from "src/components/ImagePreviewer";
import { MkdirModal } from "src/components/MkdirModal";
import { ModalButton, ModalLink } from "src/components/ModalLink";
import { TitleText } from "src/components/PageTitle";
import { TableTitle } from "src/components/TableTitle";
import { UploadModal } from "src/components/UploadModal";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { AppRouter } from "src/server/trpc/router";
import { convertToBytes } from "src/utils/format";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { urlToDownload } from "./api";
import { CreateFileModal } from "./CreateFileModal";
import { FileTable } from "./FileTable.jsx";
import { PathBar } from "./PathBar";
import { RenameModal } from "./RenameModal";

interface Props {
  cluster: Cluster;
  loginNodes: Record<string, string>;
  path: string;
  urlPrefix: string;
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

type FileInfo = inferRouterOutputs<AppRouter>["file"]["listDirectory"][0];

const fileInfoKey = (f: FileInfo, path: string): string => join(path, f.name);

interface PromiseSettledResult {
  status: string;
  value?: FileInfo | undefined;
}

export const FileManager: React.FC<Props> = ({ cluster, path, urlPrefix }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.fileManager.");
  const languageId = useI18n().currentLanguage.id;

  const operationTexts = {
    copy: t(p("copy")),
    move: t(p("move")),
  };
  const { message, modal } = App.useApp();
  const router = useRouter();
  const { publicConfig } = usePublicConfig();

  const prevPathRef = useRef<string>(path);

  const [selectedKeys, setSelectedKeys] = useState<FileInfoKey[]>([]);
  const { operation, setOperation } = useOperation();
  const [showHiddenFile, setShowHiddenFile] = useState(false);

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

  const filesQuery = trpc.file.listDirectory.useQuery({
    clusterId: cluster.id, path,
  }, { enabled: path !== "~" });


  const reload = filesQuery.refetch;

  const fullUrl = (path: string) => join(urlPrefix, cluster.id, path);

  const up = () => {
    const paths = path.split("/");

    const newPath = paths.length === 1
      ? path : "/" + paths.slice(0, paths.length - 1).join("/");
    router.replace(fullUrl(newPath));
  };

  const toHome = () => {
    router.push(fullUrl("~"));
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


  const copyOrMoveMutation = trpc.file.copyOrMove.useMutation({
    onError(error) {
      const operationText = operationTexts[operation!.op];

      if (error.data?.code === "CONFLICT") {
        Modal.error({
          title: `${operationText}${t(p("fail"))}`,
          content: t(p("alreadyExist")),
        });
        return;
      }

      if (error.data?.code === "BAD_REQUEST") {
        Modal.error({
          title: `${operationText}${t(p("fail"))}`,
          content: t(p("alreadyExist")),
        });
        return;
      }

      Modal.error({
        title: `${operationText}${t(p("fail"))}`,
        content: error.message,
      });
    },
    onSettled() {
      resetSelectedAndOperation();
      reload();
    },
  });

  const paste = async () => {
    if (!operation) { return; }
    const operationText = operationTexts[operation.op];

    setOperation({ ...operation, started: true });

    // if only one file is selected, show detailed error information
    if (operation.selected.length === 1) {
      const filename = operation.selected[0].name;
      const fromPath = join(operation.originalPath, filename);

      copyOrMoveMutation.mutate({
        op: operation.op,
        clusterId: cluster.id, fromPath, toPath: join(path, filename),
      });

      return;
    }

    await Promise.allSettled(operation.selected.map(async (x) => {
      return await copyOrMoveMutation.mutateAsync({
        op: operation.op,
        clusterId: cluster.id,
        fromPath: join(operation.originalPath, x.name),
        toPath: join(path, x.name),
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
          message.success(`${operationText}${allCount}${t(p("success"))}！`);
          resetSelectedAndOperation();
        } else {
          message.error(`${operationText}${t(p("success"))}${successfulCount}，`
          + `${t(p("fail"))}${allCount - successfulCount}`);
        }
      }).catch((e) => {
        console.log(e);
        message.error(`${t(p("exec"))}${operationText}${t(p("encounterError"))}`);
      }).finally(() => {
        resetSelectedAndOperation();
        reload();
      });

  };

  const deleteMutation = trpc.file.deleteItem.useMutation();

  const onDeleteClick = () => {
    const files = keysToFiles(selectedKeys);
    modal.confirm({
      title: t(p("confirmDelTitle")),
      content:
      `${t(p("confirmDelText"),[files.length])}`,
      onOk: async () => {
        await Promise.allSettled(files.map(async (x: FileInfo) => {
          return deleteMutation.mutateAsync({
            target: x.type,
            clusterId: cluster.id,
            path: join(path, x.name),
          }).then(() => x).catch(() => undefined);
        }))
          .then((successfulInfo) => {
            const failedCount = successfulInfo.filter((x: PromiseSettledResult) =>
              (!x || x.status === "rejected" || !x.value)).length;
            const allCount = files.length;
            if (failedCount === 0) {
              message.success(`${t(p("delText"),[allCount])}`);
              resetSelectedAndOperation();
            } else {
              message.error(`${t(p("delText2"),[allCount - failedCount,failedCount])}`);
              setOperation((o) => o && ({ ...o, started: false }));
            }
          }).catch((e) => {
            console.log(e);
            message.error(t(p("errorText1")));
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
    return filesQuery.data?.filter((x: FileInfo) => keys.includes(fileInfoKey(x, path))) ?? [];
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
        src: urlToDownload(cluster.id, join(path, filename), false, publicConfig.BASE_PATH),
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

  return (
    <div>
      <TitleText>
        <span>
          {t(p("cluster"))} {getI18nConfigCurrentText(cluster.name, languageId)} {t(p("fileManage"))}
        </span>
      </TitleText>
      <TopBar>
        <Button onClick={toHome} icon={<HomeOutlined />} shape="circle" />
        <Button onClick={up} icon={<UpOutlined />} shape="circle" />
        <PathBar
          path={path}
          loading={filesQuery.isFetching}
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
            clusterId={cluster.id}
            path={path}
            reload={reload}
          >
            {t(p("upload"))}
          </UploadButton>
          <Divider type="vertical" />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={onDeleteClick}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("delSelected"))}
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() =>
              setOperation({ op: "copy",
                selected: keysToFiles(selectedKeys), originalPath: path, started: false, completed: [],
              })}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("copySelected"))}
          </Button>
          <Button
            icon={<ScissorOutlined />}
            onClick={() =>
              setOperation({
                op:"move",
                selected: keysToFiles(selectedKeys), originalPath: path, started: false, completed: []})}
            disabled={selectedKeys.length === 0 || operation?.started}
          >
            {t(p("moveSelected"))}
          </Button>
          <Button
            icon={<SnippetsOutlined />}
            onClick={paste}
            disabled={!operation || operation.started || operation.originalPath === path}
          >
            {t(p("pasteSelected"))}
          </Button>
          {
            operation ? (
              operation.started ? (
                <span>
                  {`${t(p("ing"))}${operationTexts[operation.op]}，` +
                    `${t(p("completed"))}：${operation.completed.length} / ${operation.selected.length}`}
                </span>
              ) : (
                <span>
                  {`${t(p("select"))}${operationTexts[operation.op]}${operation.selected.length}${t(p("item"))}`}
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
            {showHiddenFile ? t(p("noDisplay")) : t(p("display"))}{t(p("hidden"))}
          </Button>
          <CreateFileButton
            cluster={cluster}
            path={path}
            reload={reload}
          >
            {t(p("newFile"))}
          </CreateFileButton>
          <MkdirButton
            clusterId={cluster.id}
            path={path}
            reload={() => reload()}
          >
            {t(p("newDir"))}
          </MkdirButton>
        </Space>
      </OperationBar>
      <FileTable
        files={filesQuery.data ?? []}
        filesFilter={(files) => files.filter((file) => showHiddenFile || !file.name.startsWith("."))}
        loading={filesQuery.isFetching}
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
              router.push(fullUrl(join(path, r.name)));
            } else if (r.type === "FILE") {
              handlePreview(r.name, r.size);
            }
          },
        })}
        fileNameRender={(_, r) => (
          r.type === "DIR" ? (
            <Link href={fullUrl(join(path, r.name))} passHref>
              {r.name}
            </Link>
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
                <a href={urlToDownload(cluster.id, join(path, i.name), true, publicConfig.BASE_PATH)}>
                  {t(p("download"))}
                </a>
              )
            }
            <RenameLink
              cluster={cluster}
              path={join(path, i.name)}
              reload={reload}
            >
              {t(p("rename"))}
            </RenameLink>
            <a onClick={() => {
              const fullPath = join(path, i.name);
              modal.confirm({
                title: t(p("confirmDelTitle")),
                // icon: < />,
                content: `${t(p("confirmDelTitle"))}${fullPath}？`,
                okText: t("button.confirmButton"),
                onOk: () => {
                  deleteMutation.mutate({
                    target: i.type, clusterId: cluster.id, path: fullPath,
                  }, {
                    onSuccess: () => {
                      message.success(t(p("delSuccessful")));
                      resetSelectedAndOperation();
                      reload();
                    },
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
      <ImagePreviewer previewImage={previewImage} setPreviewImage={setPreviewImage} />
      <FileEditModal previewFile={previewFile} setPreviewFile={setPreviewFile} />
    </div>
  );
};

const RenameLink = ModalLink(RenameModal);
const CreateFileButton = ModalButton(CreateFileModal, { icon: <FileAddOutlined /> });
const MkdirButton = ModalButton(MkdirModal, { icon: <FolderAddOutlined /> });
const UploadButton = ModalButton(UploadModal, { icon: <UploadOutlined /> });
