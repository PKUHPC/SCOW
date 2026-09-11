import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { formatMBToGB } from "@scow/lib-web/build/utils/sizeFormatter";
import { getPublicStorageConfig } from "@scow/config/build/storage";
import { AccountStorageQuotaState, StorageServiceClient } from "@scow/protos/build/server/storage";
import { Descriptions, Tag } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { useStore } from "simstate";
import { USE_MOCK } from "src/apis/useMock";
import { requireAuth } from "src/auth/requireAuth";
import { ssrAuthenticate, SSRProps } from "src/auth/server";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { PageTitle } from "src/components/PageTitle";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { DisplayedAccountState, getDisplayedStateI18nTexts, UserRole } from "src/models/User";
import { checkQueryAccountNameIsAdmin } from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { getAccounts } from "src/pages/api/tenant/getAccounts";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getTenantStorageAccess } from "src/server/tenantStorageAccess";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClient } from "src/utils/client";
import { safeGetStringProperty } from "src/utils/format";
import { Head } from "src/utils/head";
import { moneyNumberToString } from "src/utils/money";
import { getStorageDisplayName } from "src/utils/storageDisplay";

type Props = SSRProps<{
  accountName: string;
  ownerName?: string;
  ownerId?: string;
  balance: number;
  blocked: boolean;
  displayedState: DisplayedAccountState;
  blockThresholdAmount: number;
  storageQuotas: { storageId: string; quotaMb: number }[];
}, 404>;

export const AccountInfoPage: NextPage<Props> = requireAuth(
  (u) => u.accountAffiliations.length > 0,
  checkQueryAccountNameIsAdmin,
)((props: Props) => {
  const t = useI18nTranslateToString();
  const { currentLanguage: { id: languageId } } = useI18n();
  const { storageEnabled, publicStorageConfigs } = useStore(ClusterInfoStore);

  const DisplayedStateI18nTexts = getDisplayedStateI18nTexts(t);

  if ("error" in props) {
    return <UnifiedErrorPage code={props.error} />;
  }

  const { accountName, balance, ownerId, ownerName, displayedState, blockThresholdAmount, storageQuotas } = props;
  const title = t("common.accountInfo");

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title} />
      <Descriptions bordered column={1}>
        <Descriptions.Item label={t("common.account")}>{accountName}</Descriptions.Item>
        <Descriptions.Item label={t("common.accountOwner")}>
          {ownerName}（ID：{ownerId}）
        </Descriptions.Item>
        <Descriptions.Item label={t("common.accountStatus")}>
          <Tag color={displayedState === DisplayedAccountState.DISPLAYED_NORMAL ? "green" : "red"}>
            {DisplayedStateI18nTexts[displayedState]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t("common.accountBalance")}>
          {moneyNumberToString(balance)} {t("common.unit")}
        </Descriptions.Item>
        <Descriptions.Item label={t("common.blockThresholdAmount")}>
          {moneyNumberToString(blockThresholdAmount)} {t("common.unit")}
        </Descriptions.Item>
        {storageEnabled && storageQuotas.length > 0 && (
          <Descriptions.Item label={t("common.storageQuota")}>
            {storageQuotas.map(({ storageId, quotaMb }) => (
              <div key={storageId}>
                {getStorageDisplayName(storageId, languageId, publicStorageConfigs)}
                {": "}
                {quotaMb === 0 ? t("common.noLimit") : `${formatMBToGB(quotaMb).toFixed(2)} GB`}
              </div>
            ))}
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  );
});

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const accountName = queryToString(ctx.query.accountName);

  if (USE_MOCK) {
    return { props: {
      accountName,
      balance: 10.23,
      ownerId: "ownerId",
      ownerName: "123",
      blocked: true,
      displayedState: DisplayedAccountState.DISPLAYED_BLOCKED,
      blockThresholdAmount: 1.23,
      storageQuotas: [],
    } };
  }

  const auth = ssrAuthenticate((i) =>
    i.accountAffiliations.some((x) => x.accountName === accountName && x.role !== UserRole.USER),
  );

  const info = await auth(ctx.req);

  if (typeof info === "number") {
    return { props: { error: info } };
  }

  const accounts = await getAccounts({ accountName, tenantName: info.tenant });

  if (accounts.length === 0) {
    return { props: { error: 404 } };
  }

  const account = accounts[0];

  // 查询账户存储配额（仅当账户存储配额功能已开启时）
  let storageQuotas: { storageId: string; quotaMb: number }[] = [];
  const storageClient = getClient(StorageServiceClient);
  const { state } = await asyncClientCall(storageClient, "getAccountStorageQuotaState", {})
    .catch(() => ({ state: AccountStorageQuotaState.UNKNOWN, confirmed: false }));

  if (state === AccountStorageQuotaState.ENABLED) {
    // 与 TenantAccountStorageManagerTable 保持一致：从集群 entryPaths 中收集去重的配额存储 ID
    const clusterConfigs = await getClusterConfigFiles().catch(() => ({}));
    let publicStorageConfig = { storages: [] as { storageId: string; quotaEnabled?: boolean }[] };
    try { publicStorageConfig = getPublicStorageConfig(); } catch { /* storage.yaml missing */ }
    const publicStorageMap = new Map(publicStorageConfig.storages.map((s) => [s.storageId, s]));
    const seen = new Set<string>();
    const quotaStorageIds: string[] = [];
    for (const clusterConfig of Object.values(clusterConfigs)) {
      for (const entryPath of (clusterConfig.entryPaths ?? [])) {
        if (publicStorageMap.get(entryPath.storageId)?.quotaEnabled && !seen.has(entryPath.storageId)) {
          seen.add(entryPath.storageId);
          quotaStorageIds.push(entryPath.storageId);
        }
      }
    }

    const results = await Promise.all(
      quotaStorageIds.map(async (storageId) => {
        try {
          // 账户详情只能展示租户授权集群所挂载的存储。授权通过后，mis-server 仍可在
          // 挂载同一共享存储的所有激活集群间选择 scowd，不限制实际执行集群。
          if (await getTenantStorageAccess(info.tenant, storageId) !== "allowed") return null;

          const result = await asyncClientCall(storageClient, "getAccountQuota", {
            tenantName: info.tenant,
            storageId,
            accountName,
          });
          const accountInfo = result.accountsQuotaInfo[0];
          if (!accountInfo) return null;
          return { storageId, quotaMb: Number(accountInfo.quotaMb) };
        } catch {
          return null;
        }
      }),
    );
    storageQuotas = results.filter((r): r is { storageId: string; quotaMb: number } => r !== null);
  }

  return { props: {
    balance: moneyToNumber(account.balance),
    accountName,
    ownerId: safeGetStringProperty(account.ownerId),
    ownerName: safeGetStringProperty(account.ownerName),
    blocked: account.blocked,
    displayedState: account.displayedState,
    blockThresholdAmount: moneyToNumber(account.blockThresholdAmount ?? account.defaultBlockThresholdAmount),
    storageQuotas,
  } };
};

export default AccountInfoPage;
