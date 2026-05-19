import { DatabaseOutlined, FolderAddOutlined } from "@ant-design/icons";
import { fileIcon as FileIcon } from "@scow/lib-web/build/icons/commonIcons";
import { Button, Modal } from "antd";
import Link from "next/link";
import { join } from "path";
import React, { Key, useCallback, useEffect, useRef, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { FileTable } from "src/pageComponents/filemanager/FileTable";
import { MkdirModal } from "src/pageComponents/filemanager/MkdirModal";
import { PathBar } from "src/pageComponents/filemanager/PathBar";
import { FileInfo } from "src/pages/api/file/list";
import { Cluster } from "src/utils/cluster";
import { styled } from "styled-components";

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
  cluster: Cluster;
  onSubmit: (path: string) => void;
}

// 处理path的特殊情况,比如为空或者不以"/"开头
const formatPath = (path: string) => {
  if (path === "") {
    return "/";
  }
  if (!path.startsWith("/")) {
    return "/" + path;
  }
  return path;
};

export const FileSelectModal: React.FC<Props> = ({ cluster, onSubmit }) => {
  const { data: homeDirectory, isLoading: isGettingHomeDirectoryLoading } = useAsync({
    promiseFn: useCallback(async () => api.getHomeDirectory({ query: { cluster: cluster.id } }), [cluster.id]),
  });

  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState<string>("/");
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  const prevPathRef = useRef<string>(path);

  const fileFilter = (files: FileInfo[]): FileInfo[] => {
    return files.filter((file) => file.type === "DIR" && !file.name.startsWith("."));
  };

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
      prevPathRef.current = path;
    },
    onReject(_) {
      if (prevPathRef.current !== path) {
        setPath(prevPathRef.current);
      }
    },
  });

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
    setPath(clickPath);
    setSelectedKeys([]);
  };

  const isLoading = isFileLoading;

  const t = useI18nTranslateToString();
  const p = prefix("pageComp.job.fileSelectModal.");

  useEffect(() => {
    setPath(homeDirectory?.path ?? "/");
  }, [homeDirectory]);

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
      <Modal
        width={600}
        open={visible}
        onCancel={() => {
          closeModal();
        }}
        title={t(p("title"))}
        footer={[
          <MkdirButton key="new" cluster={cluster.id} path={join("/", path)} reload={reload}>
            {t(p("newPath"))}
          </MkdirButton>,
          <Button
            key="cancel"
            onClick={() => {
              closeModal();
            }}
          >
            {t("button.cancelButton")}
          </Button>,
          <Button key="ok" type="primary" onClick={onOkClick}>
            {t("button.confirmButton")}
          </Button>,
        ]}
      >
        <ModalContainer>
          <TopBar>
            <PathBar
              path={formatPath(path)}
              loading={isLoading}
              onPathChange={(curPath) => {
                if (curPath === path) {
                  reload();
                } else {
                  setPath(join("/", curPath));
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
          <FileTable
            style={{ width: "100%" }}
            files={data?.items || []}
            filesFilter={fileFilter}
            fileNameRender={(fileName: string) => <Button type="link">{fileName}</Button>}
            hiddenColumns={["size", "mode"]}
            loading={isLoading}
            pagination={false}
            rowKey={(r: FileInfo): React.Key => join(path, r.name)}
            onRow={(r) => ({
              onClick: () => {
                setSelectedKeys([join(path, r.name)]);
              },
              onDoubleClick: () => {
                setPath(join(path, r.name));
              },
            })}
            rowSelection={{
              type: "radio",
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
            }}
            scroll={{ x: true, y: 500 }}
          />
        </ModalContainer>
      </Modal>
    </>
  );
};

const MkdirButton = ModalButton(MkdirModal, { icon: <FolderAddOutlined /> });
