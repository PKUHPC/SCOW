"use client";

import "@xterm/xterm/css/xterm.css";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Button, Space } from "antd";
import dynamic from "next/dynamic";
import { use } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";
import { styled } from "styled-components";

const Container = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  z-index: 2000;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  background-color: #333;

  h2 {
    color: white;
    margin: 0px;
  }
`;

const TerminalContainer = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
`;

const Black = styled.div`
  height: 100%;
  background-color: black;
`;

const LoginNodeShellComponent = dynamic(
  () => import("src/components/shell/LoginNodeShell").then((x) => x.LoginNodeShell),
  {
    ssr: false,
    loading: Black,
  },
);

export default function Page({
  params,
}: {
  params: Promise<{ cluster: string; loginNode: string; path?: string[] }>;
}) {
  const t = useI18nTranslateToString();
  const p = prefix("app.shell.");

  const { cluster, loginNode, path } = use(params);
  const { publicConfig, scowClusterConfigs } = usePublicConfig();

  const clusterName = publicConfig.CLUSTERS.find((x) => x.id === cluster)?.name || cluster;
  const loginNodeName =
    scowClusterConfigs[cluster]?.loginNodes
      ?.map((x) => (typeof x === "string" ? { name: x, address: x } : x))
      .find((x) => x.address === loginNode)?.name ?? loginNode;

  const i18n = useI18n();

  const i18nClusterName = getI18nConfigCurrentText(clusterName, i18n.currentLanguage.id);
  const i18nLoginNodeName = getI18nConfigCurrentText(loginNodeName, i18n.currentLanguage.id);

  useDocumentTitle(`${cluster}${t(p("terminal"))}`);

  return (
    <Container>
      <Header>
        <h2>{t(p("content"), ["root", i18nClusterName, i18nLoginNodeName])}</h2>
        <Space wrap>
          <Button onClick={() => window.location.reload()}>{t(p("refresh"))}</Button>
        </Space>
      </Header>
      <TerminalContainer>
        <LoginNodeShellComponent cluster={cluster} loginNode={loginNode} path={path ? "/" + path.join("/") : ""} />
      </TerminalContainer>
    </Container>
  );
}
