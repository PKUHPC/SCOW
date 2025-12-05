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

import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { joinWithUrl } from "@scow/utils";
import { Tabs,Typography } from "antd";
import { NextPage } from "next";
import path from "path";
import { requireAuth } from "src/auth/requireAuth";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { antdBreakpoints } from "src/styles/constants";
import { publicConfig } from "src/utils/config";
import { DEFAULT_GRAFANA_URL } from "src/utils/constants";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
`;

const FrameContainer = styled.div`
  display: flex;
  width: 100%;
  height: 69vh;
`;

const IFrame = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
`;

const TitleText = styled(Typography.Title)`
&& {
  width: 100vw;
  font-size: 28px;
  padding: 0 0 10px 20px;
  margin-left: -25px;
  border-bottom: 1px solid #ccc;
  @media (min-width: ${antdBreakpoints.md}px) {
    padding: 0 0 20px 30px;
  }
}
`;

const p = prefix("page.admin.monitor.resourceStatus.");

export const ResourceStatusPage: NextPage = requireAuth(
  (u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(() => {

  const t = useI18nTranslateToString();
  const { dark } = useDarkMode();

  const dashboardUid = publicConfig.CLUSTER_MONITOR.resourceStatus.dashboardUid;
  let dashboards = publicConfig.CLUSTER_MONITOR.resourceStatus.dashboards;
  const themeQuery = `?theme=${dark ? "dark" : "light"}`;

  const normalGrafanaUrls: string[] = [];
  const proxyGrafanaUrls: string[] = [];

  if (!(dashboards?.length && dashboards?.length > 0) && dashboardUid) {
    dashboards = [{ uid: dashboardUid, label: t(p("resourceStatus")) }];
  }

  dashboards?.map((dashboard) => {
    normalGrafanaUrls.push(joinWithUrl(publicConfig.CLUSTER_MONITOR.grafanaUrl ?? DEFAULT_GRAFANA_URL,
      `/d/${dashboard.uid}`) + themeQuery);
    proxyGrafanaUrls.push(path.join(publicConfig.BASE_PATH, "/api/admin/monitor/getResourceStatus",
      `/d/${dashboard.uid}`) + themeQuery);
  });

  return (
    <>
      <Container>
        <Head title={t(p("clusterMonitor"))} />
        <TitleText>{t(p("clusterMonitor"))}</TitleText>
        <Tabs
          defaultActiveKey={dashboards?.[0]?.uid}
          items={ dashboards?.map((dashboard, index) => (
            { key: dashboard?.uid ?? "",
              label: (<span style={{ fontSize: 16 }}>{dashboard?.label}</span>),
              children: (publicConfig.CLUSTER_MONITOR.resourceStatus.proxy
                ? <FrameContainer><IFrame src={proxyGrafanaUrls[index]}></IFrame></FrameContainer>
                : <FrameContainer><IFrame src={normalGrafanaUrls[index]}></IFrame></FrameContainer>),
            }
          ))}
        />
      </Container>
    </>

  );
});

export default ResourceStatusPage;
