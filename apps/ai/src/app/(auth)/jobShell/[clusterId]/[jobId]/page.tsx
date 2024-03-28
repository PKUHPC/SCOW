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

"use client";

import "xterm/css/xterm.css";

import { Button, Space } from "antd";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePublicConfig } from "src/app/(auth)/context";
import { Head } from "src/utils/head";
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

const JobShellComponent = dynamic(
  () => import("src/components/shell/JobShell").then((x) => x.JobShell), {
    ssr: false,
    loading: Black,
  });

export default function Page({ params }: {params: {clusterId: string, jobId: string}}) {

  const { clusterId, jobId } = params;
  const { publicConfig, user } = usePublicConfig();
  const router = useRouter();

  const clusterName = publicConfig.CLUSTERS.find((x) => x.id === clusterId)?.name || clusterId;

  return (
    <Container>
      <Head title={`${clusterId}的终端`} />
      <Header>
        <h2>
          {`以ID: ${user.identityId} 连接到集群 ${clusterName} 的 ${jobId} 的 POD`}
        </h2>
        <Space wrap>
          <Button onClick={() => router.refresh()}>
            {"刷新并重新连接"}
          </Button>
        </Space>
      </Header>
      <TerminalContainer>
        <JobShellComponent
          user={user}
          cluster={clusterId}
          jobId={jobId}
        />
      </TerminalContainer>
    </Container>
  );
};