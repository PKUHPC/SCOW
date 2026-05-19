"use client";

import "@xterm/xterm/css/xterm.css";
import { Button, Select, Space } from "antd";
import dynamic from "next/dynamic";
import { use, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
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

const JobLogComponent = dynamic(() => import("./JobLogs").then((x) => x.JobLogs), {
  ssr: false,
  loading: Black,
});

export default function Page(props: { params: Promise<{ clusterId: string; podId: string; podName: string }> }) {
  const params = use(props.params);
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.jobLogs.");

  const { clusterId, podId, podName } = params;
  const { user } = usePublicConfig();
  const [rowLimit, setRowLimit] = useState<number | null>(1000);

  useDocumentTitle(t(p("title"), [podName]));

  return (
    <Container>
      <Header>
        <h2 style={{ display: "flex" }}>{t(p("title"), [podName])}</h2>
        <Space wrap>
          <h2 style={{ display: "flex", alignItems: "center" }}>
            {t(p("rowsCount"))}: &nbsp;
            <Select
              value={rowLimit}
              style={{ width: 120 }}
              onChange={setRowLimit}
              options={[
                { value: 1000, label: "1000 " + t(p("rows")) },
                { value: 2000, label: "2000 " + t(p("rows")) },
                { value: 5000, label: "5000 " + t(p("rows")) },
                { value: 10000, label: "10000 " + t(p("rows")) },
                { value: null, label: t(p("all")) },
              ]}
              getPopupContainer={(trigger) => trigger.parentElement}
            />
            &nbsp;&nbsp;&nbsp;&nbsp;
            <Button onClick={() => window.location.reload()}>{t("button.refreshButton")}</Button>
          </h2>
        </Space>
      </Header>
      <TerminalContainer>
        <JobLogComponent user={user} cluster={clusterId} podId={podId} rowLimit={rowLimit ?? undefined} />
      </TerminalContainer>
    </Container>
  );
}
