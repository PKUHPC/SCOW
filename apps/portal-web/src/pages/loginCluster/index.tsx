import { getSortedClusterIds } from "@scow/config/build/cluster";
import { ClusterActivationStatus } from "@scow/config/build/type";
import { getCurrentLanguageId, getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Tabs } from "antd";
import { Card } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { requireAuth } from "src/auth/requireAuth";
import { AuthResultError, ssrAuthenticate } from "src/auth/server";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { useI18nTranslateToString } from "src/i18n";
import { DesktopCardList } from "src/pageComponents/loginCluster/DesktopCardList";
import { ShellCardList } from "src/pageComponents/loginCluster/ShellCardList";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

interface Cluster {
  id: string;
  name: string;
  shadowdeskEnabled?: boolean;
  hasShadowdeskConfig?: boolean;
  shadowdeskAvailableWms?: string[];
  description?: string;
};

type Props = {
  error: AuthResultError;
} | {
  loginDesktopEnabledClusters: Cluster[];
};

const Container = styled.div`
  padding: 24px;
`;

const StyledCard = styled(Card)`
  .ant-card-head {
    border-bottom: none;
    padding: 16px 24px 0;
  }
  .ant-card-body {
    padding-top: 0;
  }
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    margin-bottom: 24px;
  }

`;

export const LoginClusterPage: NextPage<Props> = requireAuth(() => true)(
  (props: Props) => {

    if ("error" in props) {
      return <UnifiedErrorPage code={props.error} />;
    }

    const { loginDesktopEnabledClusters } = props;

    const { enableLoginDesktop } = useStore(ClusterInfoStore);

    if ((!enableLoginDesktop && !publicConfig.ENABLE_SHELL) || loginDesktopEnabledClusters.length === 0) {
      return <ClusterNotAvailablePage />;
    }

    const t = useI18nTranslateToString();

    const [activeTab, setActiveTab] = useState("shell");

    const onTabChange = (key: string) => {
      setActiveTab(key);
    };

    const tabsItems = [
      {
        label: t("pageComp.loginCluster.shell"),
        key: "shell",
        children: <ShellCardList clusters={loginDesktopEnabledClusters} />,
      },
      {
        label: t("pageComp.loginCluster.desktop"),
        key: "desktop",
        children: <DesktopCardList clusters={loginDesktopEnabledClusters} />,
      },
    ];

    return (
      <Container>
        <Head title={t("routes.loginCluster")} />
        <StyledCard>
          <StyledTabs
            activeKey={activeTab}
            onChange={onTabChange}
            items={tabsItems}
          />
        </StyledCard>
      </Container>
    );
  });


export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  // Cannot directly call api routes here, so mock is not available directly.
  // manually call mock
  if (USE_MOCK) {
    return {
      props: {
        loginDesktopEnabledClusters: [{ id: "hpc01", name: "hpc01Name" }],
      },
    };
  }

  const auth = ssrAuthenticate(() => true);

  const info = await auth(req);
  if (typeof info === "number") {
    return { props: { error: info } };
  }

  const token = getTokenFromCookie({ req });
  // 所有配置集群
  const resp = await api.getClusterConfigFiles({ query: { token } });
  const clusterConfigs = resp.clusterConfigs;
  const clusterSortedIdList = getSortedClusterIds(resp.clusterConfigs);
  // 集群在线信息
  const currentClusters = await api.getClustersRuntimeInfo({ query: { token } });

  // 当前启用中的集群
  const activatedClusterIds = currentClusters?.results
    .filter((x) => x.activationStatus === ClusterActivationStatus.ACTIVATED).map((x) => x.clusterId) ?? [];
  const sortedCurrentClusterIds = clusterSortedIdList.filter((id) => activatedClusterIds.includes(id));


  let sortedClusterIdList: string[];

  // 1. 如果部署了管理系统，且部署了资源管理服务
  // 选取已授权且在线集群的集群ID
  if (publicConfig.MIS_DEPLOYED && runtimeConfig.SCOW_RESOURCE_CONFIG?.enabled) {
    const userAssociatedClusterIds = await api.getUserAssociatedClusterIds({
      query: {
        token,
        userId: info.identityId,
      },
    });
    sortedClusterIdList = sortedCurrentClusterIds
      .filter((id) => ((userAssociatedClusterIds.clusterIds ?? []).includes(id)));
    // 2. 如果部署了管理系统，未部署资源管理
    // 选取在线集群的集群ID
  } else if (publicConfig.MIS_DEPLOYED) {
    sortedClusterIdList = sortedCurrentClusterIds;
    // 3. 如果没有部署管理系统
    // 选取系统所有已配置集群的集群ID
  } else {
    sortedClusterIdList = clusterSortedIdList;
  }

  const loginDesktopEnabledClusters = sortedClusterIdList
    .filter((clusterId) => getLoginDesktopEnabled(clusterId, clusterConfigs))
    .map((clusterId) => ({
      id: clusterId,
      hasShadowdeskConfig: clusterConfigs[clusterId].loginDesktop?.shadowDesk !== undefined,
      shadowdeskEnabled: clusterConfigs[clusterId].loginDesktop?.shadowDesk?.enabled || false,
      shadowdeskAvailableWms: clusterConfigs[clusterId].loginDesktop?.shadowDesk?.wms || [],
      name: getI18nConfigCurrentText(clusterConfigs[clusterId].displayName, languageId),
      description: getI18nConfigCurrentText(clusterConfigs[clusterId].description, languageId),
    } as Cluster));

  return {
    props: {
      loginDesktopEnabledClusters,
    },
  };
};

export default LoginClusterPage;
