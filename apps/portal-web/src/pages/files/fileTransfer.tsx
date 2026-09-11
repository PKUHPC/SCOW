import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { AuthResultError, ssrAuthenticate } from "src/auth/server";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { PageTitle } from "src/components/PageTitle";
import { Redirect } from "src/components/Redirect";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterFileTable } from "src/pageComponents/filemanager/ClusterFileTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { Head } from "src/utils/head";
import { useTheme } from "styled-components";

type FileInfoKey = React.Key;

type Props =
  | {
      error: AuthResultError;
    }
  | {
      error?: undefined;
    };

interface ButtonProps {
  icon: React.ReactNode;
  disabled: boolean;
  srcCluster: Cluster | undefined;
  dstCluster: Cluster | undefined;
  selectedKeys: FileInfoKey[];
  toPath: string;
}

const p = prefix("pages.files.fileTransfer.");

/** 文件传输页面顶部固定元素（导航栏 + 页面标题）占用的像素高度 */
const TRANSFER_PAGE_OFFSET_PX = 110 + 30;

const OperationButton: React.FC<ButtonProps> = (props) => {
  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const { message, modal } = App.useApp();

  const { icon, disabled, srcCluster, dstCluster, selectedKeys, toPath } = props;
  const { token } = useTheme();

  return (
    <Button
      icon={<span style={{ color: disabled ? undefined : token.colorPrimary }}>{icon}</span>}
      size="small"
      style={{ width: 36, height: 36, padding: "0 12px", boxSizing: "border-box" }}
      disabled={disabled}
      onClick={async () => {
        if (srcCluster && dstCluster) {
          const srcClusterName = getI18nConfigCurrentText(srcCluster.name, languageId);
          const dstClusterName = getI18nConfigCurrentText(dstCluster.name, languageId);
          modal.confirm({
            title: t(p("confirmTransferTitle")),
            content: t(p("confirmTransferContent"), [srcClusterName, dstClusterName]),
            okText: t(p("confirmOk")),
            onOk: async () => {
              Promise.all(
                selectedKeys.map(async (key) => {
                  await api
                    .startFileTransfer({
                      body: {
                        fromCluster: srcCluster.id,
                        toCluster: dstCluster.id,
                        fromPath: String(key),
                        toPath: toPath,
                      },
                    })
                    .then(() => {
                      message.success(t(p("transferStartInfo")));
                    });
                }),
              );
            },
          });
        }
      }}
    />
  );
};

export const FileTransferPage: NextPage<Props> = requireAuth(() => true)((props: Props) => {
  if (props.error !== undefined) {
    return <UnifiedErrorPage code={props.error} />;
  }

  const t = useI18nTranslateToString();

  const { crossClusterFileTransferEnabled } = useStore(ClusterInfoStore);

  if (!crossClusterFileTransferEnabled) {
    return <Redirect url="/dashboard" />;
  }

  const [clusterLeft, setClusterLeft] = useState<Cluster>();
  const [clusterRight, setClusterRight] = useState<Cluster>();

  const [pathLeft, setPathLeft] = useState<string>("");
  const [pathRight, setPathRight] = useState<string>("");

  const [selectedKeysLeft, setSelectedKeysLeft] = useState<FileInfoKey[]>([]);
  const [selectedKeysRight, setSelectedKeysRight] = useState<FileInfoKey[]>([]);

  return (
    <>
      <Head title={t(p("transferTitle"))} />
      <PageTitle titleText={t(p("transferTitle"))} />
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: `calc(100vh - ${TRANSFER_PAGE_OFFSET_PX}px)`,
          marginBottom: 29,
          overflow: "hidden",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <ClusterFileTable
            selectedCluster={clusterLeft}
            setSelectedCluster={setClusterLeft}
            path={pathLeft}
            setPath={setPathLeft}
            selectedKeys={selectedKeysLeft}
            setSelectedKeys={setSelectedKeysLeft}
            excludeCluster={clusterRight}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            padding: "0 4px",
          }}
        >
          <OperationButton
            icon={<ArrowRightOutlined />}
            disabled={!clusterLeft || !clusterRight || selectedKeysLeft.length === 0}
            srcCluster={clusterLeft}
            dstCluster={clusterRight}
            selectedKeys={selectedKeysLeft}
            toPath={pathRight}
          />
          <OperationButton
            icon={<ArrowLeftOutlined />}
            disabled={!clusterLeft || !clusterRight || selectedKeysRight.length === 0}
            srcCluster={clusterRight}
            dstCluster={clusterLeft}
            selectedKeys={selectedKeysRight}
            toPath={pathLeft}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <ClusterFileTable
            selectedCluster={clusterRight}
            setSelectedCluster={setClusterRight}
            path={pathRight}
            setPath={setPathRight}
            selectedKeys={selectedKeysRight}
            setSelectedKeys={setSelectedKeysRight}
            excludeCluster={clusterLeft}
          />
        </div>
      </div>
    </>
  );
});

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const auth = ssrAuthenticate(() => true);

  const info = await auth(req);
  if (typeof info === "number") {
    return { props: { error: info } };
  }

  return { props: {} };
};
export default FileTransferPage;
