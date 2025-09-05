import { getSortedClusterIds } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import { ClusterActivationStatus } from "@scow/config/build/type";
import { getCurrentLanguageId, getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { GetServerSideProps, NextPage } from "next";
import { useStore } from "simstate";
import { api } from "src/apis";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { requireAuth } from "src/auth/requireAuth";
import { AuthResultError, ssrAuthenticate } from "src/auth/server";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { DesktopTable } from "src/pageComponents/desktop/DesktopTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { Head } from "src/utils/head";

interface Cluster { id: string; name: I18nStringType;
  shadowdeskEnabled?: boolean; hasShadowdeskConfig?: boolean; shadowdeskAvailableWms?: string[]; };

type Props = {
  error: AuthResultError;
} | {
  loginDesktopEnabledClusters: Cluster[];
};

export const DesktopIndexPage: NextPage<Props> = requireAuth(() => true)(
  (props: Props) => {

    if ("error" in props) {
      return <UnifiedErrorPage code={props.error} />;
    }

    const { enableLoginDesktop } = useStore(ClusterInfoStore);
    if (!enableLoginDesktop || props.loginDesktopEnabledClusters.length === 0) {
      return <ClusterNotAvailablePage />;
    }

    const t = useI18nTranslateToString();

    return (
      <div>
        <Head title={t("pages.desktop.title")} />
        <PageTitle titleText={t("pages.desktop.pageTitle")} />
        <DesktopTable loginDesktopEnabledClusters={props.loginDesktopEnabledClusters} />
      </div>
    );
  });


export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  // Cannot directly call api routes here, so mock is not available directly.
  // manually call mock
  if (USE_MOCK) {
    return {
      props: {
        loginDesktopEnabledClusters: [ { id: "hpc01", name: "hpc01Name" } ],
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
    const userAssociatedClusterIds = await api.getUserAssociatedClusterIds({ query: {
      token,
      userId: info.identityId,
    } });
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
      name: getI18nConfigCurrentText(clusterConfigs[clusterId].displayName, languageId) } as Cluster));

  return {
    props: {
      loginDesktopEnabledClusters,
    },
  };
};

export default DesktopIndexPage;
