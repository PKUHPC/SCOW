import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Col, Row } from "antd";
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

const OperationButton: React.FC<ButtonProps> = (props) => {
  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const { message, modal } = App.useApp();

  const { icon, disabled, srcCluster, dstCluster, selectedKeys, toPath } = props;

  return (
    <Button
      icon={icon}
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
      <Row justify="space-around" align="top">
        <Col span={11}>
          <ClusterFileTable
            selectedCluster={clusterLeft}
            setSelectedCluster={setClusterLeft}
            path={pathLeft}
            setPath={setPathLeft}
            selectedKeys={selectedKeysLeft}
            setSelectedKeys={setSelectedKeysLeft}
            excludeCluster={clusterRight}
          />
        </Col>

        <Col span={0.5}>
          <Row justify="center">
            <OperationButton
              icon={<ArrowRightOutlined />}
              disabled={!clusterLeft || !clusterRight || selectedKeysLeft.length === 0}
              srcCluster={clusterLeft}
              dstCluster={clusterRight}
              selectedKeys={selectedKeysLeft}
              toPath={pathRight}
            />
          </Row>

          <Row justify="center">
            <OperationButton
              icon={<ArrowLeftOutlined />}
              disabled={!clusterLeft || !clusterRight || selectedKeysRight.length === 0}
              srcCluster={clusterRight}
              dstCluster={clusterLeft}
              selectedKeys={selectedKeysRight}
              toPath={pathLeft}
            />
          </Row>
        </Col>

        <Col span={11}>
          <ClusterFileTable
            selectedCluster={clusterRight}
            setSelectedCluster={setClusterRight}
            path={pathRight}
            setPath={setPathRight}
            selectedKeys={selectedKeysRight}
            setSelectedKeys={setSelectedKeysRight}
            excludeCluster={clusterLeft}
          />
        </Col>
      </Row>
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
