"use client";

import "@xterm/xterm/css/xterm.css";

import { Button, Space } from "antd";
import dynamic from "next/dynamic";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
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

  h2 { color: white; margin: 0px; }

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

const JobLogComponent = dynamic(
  () => import("./JobLogs").then((x) => x.JobLogs), {
    ssr: false,
    loading: Black,
  });

export default function Page({ params }:
{ params: { clusterId: string, podId: string } })
{
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.jobLogs.");

  const { clusterId, podId } = params;
  const { user } = usePublicConfig();

  return (
    <Container>
      <Header>
        <h2>
          {t(p("title"), [podId])}
        </h2>
        <Space wrap>
          <Button onClick={() => window.location.reload()}>
            {t("button.refreshButton")}
          </Button>
        </Space>
      </Header>
      <TerminalContainer>
        <JobLogComponent
          user={user}
          cluster={clusterId}
          podId={podId}
        />
      </TerminalContainer>
    </Container>
  );
};
