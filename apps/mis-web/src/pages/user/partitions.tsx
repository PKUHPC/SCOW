import { ClusterTextsConfigSchema } from "@scow/config/build/clusterTexts";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource/build/utils";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Collapse, Divider, Space, Spin, Typography } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { checkCookie } from "src/auth/server";
import { JobBillingTable } from "src/components/JobBillingTable";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { StorageBillingTable } from "src/pageComponents/storageBilling/StorageBillingTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { getSortedClusterValues } from "src/utils/cluster";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { fetchStorageBillingItems } from "src/utils/storageBilling";
import { styled } from "styled-components";

import { JobBillingTableItem } from "../api/job/getAvailableBillingTable";

const ClusterCommentTitle = styled(Typography.Title)`
  padding-top: 8px;
  font-weight: 400;
  font-size: 16px;
`;

const ContentContainer = styled(Typography.Paragraph)`
  white-space: pre-line;
`;

type ValueOf<T> = T[keyof T];

interface Props {
  text: ValueOf<ClusterTextsConfigSchema> | undefined;
  // 用户关联账户的已授权集群Id
  assignedClusterIds: string[];
}

const p = prefix("page.user.partitions.");
const pStorageBilling = prefix("page.storageBilling.");

const { Panel } = Collapse;

export const PartitionsPage: NextPage<Props> = requireAuth(() => true)((props: Props) => {
  const userStore = useStore(UserStore);
  const user = userStore.user;

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { text, assignedClusterIds } = props;

  const [completedRequestCount, setCompletedRequestCount] = useState<number>(0);
  const [renderData, setRenderData] = useState<Record<string, JobBillingTableItem[]>>({});

  const { publicConfigClusters, clusterSortedIdList, activatedClusters, publicStorageConfigs } =
    useStore(ClusterInfoStore);

  const storageIds = useMemo(() => Object.keys(publicStorageConfigs), [publicStorageConfigs]);

  const fetchStorageBillingData = useCallback(async () => {
    if (!publicConfig.STORAGE_BILLING_ENABLED) return [];
    return fetchStorageBillingItems(storageIds, user?.tenant, false);
  }, [storageIds, user?.tenant]);

  const {
    data: storageBillingData,
    isLoading: storageLoading,
    reload: storageReload,
  } = useAsync({
    promiseFn: fetchStorageBillingData,
    watch: `${user?.tenant ?? ""}:${storageIds.join(",")}`,
  });

  const currentUserAssignedClusters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(activatedClusters).filter(([clusterId, _]) => assignedClusterIds.includes(clusterId)),
      ),
    [activatedClusters, assignedClusterIds],
  );

  const clusters = getSortedClusterValues(publicConfigClusters, clusterSortedIdList).filter((x) =>
    Object.keys(currentUserAssignedClusters).includes(x.id),
  );
  const sortedIds = clusterSortedIdList.filter((id) => currentUserAssignedClusters[id]);
  const hasBillingData = clusters.some((cluster) => (renderData[cluster.id]?.length ?? 0) > 0);

  sortedIds.forEach((clusterId) => {
    useAsync({
      promiseFn: useCallback(async () => {
        const cluster = currentUserAssignedClusters[clusterId];
        return api
          .getAvailableBillingTable({
            query: { cluster: cluster.id, tenant: user?.tenant, userId: user?.identityId },
          })
          .then((data) => {
            setRenderData((prevData) => ({
              ...prevData,
              [cluster.id]: data.items,
            }));
            setCompletedRequestCount((prevCount) => prevCount + 1);
          });
      }, [userStore.user]),
    });
  });

  return (
    <div>
      <Head title={t(p("billingStandard"))} />
      <PageTitle titleText={t(p("billingStandard"))} />

      <Typography.Title level={5} style={{ marginTop: 24, fontWeight: 400 }}>
        {t(pStorageBilling("computeResource"))}
      </Typography.Title>
      <div>
        {completedRequestCount < clusters.length ? (
          <Spin spinning={completedRequestCount < clusters.length} tip={t(p("loading"))}>
            <></>
          </Spin>
        ) : clusters.length === 0 ? (
          <>{t("common.noAvailableClusters")}</>
        ) : !hasBillingData ? (
          <>{t(pStorageBilling("noAvailableBillingData"))}</>
        ) : null}
      </div>
      <div
        style={
          completedRequestCount < clusters.length
            ? { marginBottom: "32px", marginTop: "48px" }
            : { marginBottom: "32px" }
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {clusters.map((cluster) => {
            const data = renderData[cluster.id];
            return data && data.length > 0 ? (
              <Collapse key={cluster.id} defaultActiveKey={[cluster.id]}>
                <Panel
                  header={getI18nConfigCurrentText(cluster.name, languageId)}
                  collapsible="header"
                  key={cluster.id}
                >
                  <div key={cluster.id}>
                    <JobBillingTable data={data} isUserPartitionsPage={true} />
                  </div>
                </Panel>
              </Collapse>
            ) : null;
          })}
        </Space>
      </div>

      {publicConfig.STORAGE_BILLING_ENABLED && storageIds.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24, fontWeight: 400 }}>
            {t(pStorageBilling("storageResource"))}
          </Typography.Title>
          <StorageBillingTable
            data={storageBillingData ?? []}
            loading={storageLoading}
            reload={storageReload}
            canEdit={false}
          />
        </>
      )}

      <div>
        {text?.clusterComment ? (
          <div style={{ marginTop: "48px" }}>
            <ClusterCommentTitle level={4}>{t("common.illustrate")}</ClusterCommentTitle>
            <ContentContainer>{getI18nConfigCurrentText(text?.clusterComment, languageId)}</ContentContainer>
          </div>
        ) : undefined}
        {text?.extras?.map(({ title, content }, i) => (
          <div key={i}>
            <Divider />
            <PageTitle titleText={getI18nConfigCurrentText(title, languageId)} />
            <ContentContainer>{getI18nConfigCurrentText(content, languageId)}</ContentContainer>
          </div>
        ))}
      </div>
    </div>
  );
});

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const user = await checkCookie(() => true, ctx.req);

  const clusterTexts = runtimeConfig.CLUSTER_TEXTS_CONFIG;

  // Get authorized clusters for accounts associated with the user.
  let assignedClusterIds: string[] = [];
  if (typeof user !== "number") {
    const userAccounts = user.accountAffiliations.map((aff) => aff.accountName);
    assignedClusterIds = await getUserAccountsClusterIds(runtimeConfig.SCOW_RESOURCE_CONFIG, userAccounts, user.tenant);
  }

  // find the applicable text
  const applicableTexts = clusterTexts
    ? typeof user === "number"
      ? clusterTexts
      : (clusterTexts[user.tenant] ?? clusterTexts.default)
    : undefined;

  return {
    props: {
      text: applicableTexts,
      assignedClusterIds,
    },
  };
};

export default PartitionsPage;
