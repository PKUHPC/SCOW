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

  .ant-popover-content p {
    margin: 0;
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

const JobShellComponent = dynamic(() => import("src/components/shell/JobShell").then((x) => x.JobShell), {
  ssr: false,
  loading: Black,
});

export default function Page({
  params,
}: {
  params: Promise<{ clusterId: string; jobId: string; namespace: string; podName: string }>;
}) {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobShell.");

  const { clusterId, jobId, namespace, podName } = use(params);
  const { publicConfig, user } = usePublicConfig();

  const clusterName = publicConfig.CLUSTERS.find((x) => x.id === clusterId)?.name || clusterId;

  const i18n = useI18n();

  const i18nClusterName = getI18nConfigCurrentText(clusterName, i18n.currentLanguage.id);

  useDocumentTitle(`${clusterId}${t(p("terminal"))}`);

  return (
    <Container>
      <Header>
        <h2>{`${t(p("user"))} ${user.identityId} ${t(p("connect"))} ${i18nClusterName} ${t(p("job"))} ${jobId}`}</h2>
        <Space wrap>
          <Button onClick={() => window.location.reload()}>{t(p("refresh"))}</Button>
        </Space>
      </Header>
      <TerminalContainer>
        <JobShellComponent user={user} cluster={clusterId} jobId={jobId} namespace={namespace} podName={podName} />
      </TerminalContainer>
    </Container>
  );
}
