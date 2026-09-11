import { Logger } from "@ddadaal/tsgrpc-server";
import { Loaded } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema, getClusterConfigs } from "@scow/config/build/cluster";
import { getExecutableStorageIds } from "@scow/lib-server";
import dayjs from "@scow/lib-server/build/date";
import { charge } from "src/bl/charging";
import { calculateTieredPrice, getAccountPriceItem, getPlatformPriceItem } from "src/bl/storageBilling";
import { misConfig } from "src/config/mis";
import { Account, AccountState } from "src/entities/Account";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { DailyStorageUsage } from "src/entities/DailyStorageUsage";
import { StorageBillingMode, StoragePriceItem } from "src/entities/StoragePriceItem";
import { SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { ClusterPlugin } from "src/plugins/clusters";

/**
 * 存储计费定时任务
 * 每天执行一次，计算前一天的存储费用
 */
export async function runStorageBilling(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin,
): Promise<void> {
  const storageBillingConfig = misConfig.storageBilling;
  if (!storageBillingConfig?.enabled) {
    logger.info("Storage billing is disabled, skipping.");
    return;
  }

  const billingDate = dayjs().tz("Asia/Shanghai").subtract(1, "day").format("YYYY-MM-DD");
  logger.info("Starting storage billing for date: %s", billingDate);

  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  const storageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  for (const storageId of storageIds) {
    // 检查该 storageId 是否有任何生效的价格项
    const anyPriceItem = await em.findOne(StoragePriceItem, { storageId });
    if (!anyPriceItem) {
      logger.debug("No price items for storageId=%s, skipping.", storageId);
      continue;
    }

    const tenants = await em.findAll(Tenant);

    for (const tenant of tenants) {
      try {
        const count = await billingForTenant(
          em,
          logger,
          storageId,
          tenant,
          billingDate,
          currentActivatedClusters,
          clusterPlugin,
          storageBillingConfig,
        );
        logger.info(
          "Storage billing completed for tenant=%s, storageId=%s, date=%s, charged %d records.",
          tenant.name,
          storageId,
          billingDate,
          count,
        );
      } catch (err) {
        logger.error("Error billing tenant %s for storageId=%s: %o", tenant.name, storageId, err);
      }
    }
  }
}

/** 通用计费参数 */
interface BillingContext {
  em: SqlEntityManager<MySqlDriver>;
  logger: Logger;
  storageId: string;
  billingDate: string;
  billingMode: StorageBillingMode;
  tenant: Tenant;
  account: Loaded<Account, "tenant">;
  accountPriceItem: StoragePriceItem;
  platformPriceItem: StoragePriceItem;
  currentActivatedClusters: Record<string, ClusterConfigSchema>;
  clusterPlugin: ClusterPlugin;
  config: NonNullable<typeof misConfig.storageBilling>;
}

/**
 * 计算账户的日均使用量（GB），如果尚未计算则写入 averageUsage
 */
async function getAccountDailyUsageGb(
  em: SqlEntityManager<MySqlDriver>,
  accountName: string,
  storageId: string,
  billingDate: string,
): Promise<number> {
  const daily = await em.findOne(DailyStorageUsage, {
    accountName,
    storageId,
    date: billingDate,
  });
  if (!daily) return 0;

  if (daily.averageUsage == null && daily.usages.length > 0) {
    const avg = daily.usages.reduce((a, b) => a + b, 0) / daily.usages.length;
    daily.averageUsage = Math.ceil(avg);
    em.persist(daily);
  }
  return daily.averageUsage ?? 0;
}

/**
 * 执行扣费：向账户扣费 + 向租户扣费
 */
async function doCharge(
  billingContext: BillingContext,
  billedGb: number,
  commentPrefix: string,
): Promise<number> {
  if (billedGb <= 0) return 0;

  const {
    em,
    logger,
    storageId,
    billingDate,
    billingMode,
    tenant,
    account,
    accountPriceItem,
    platformPriceItem,
    currentActivatedClusters,
    clusterPlugin,
    config,
  } = billingContext;

  const billingModeText = billingMode === StorageBillingMode.USAGE ? "使用量" : "配额";
  const chargeType = config.chargeType;

  const accountPrice = calculateTieredPrice(billedGb, accountPriceItem.tiers);
  const tenantPrice = calculateTieredPrice(billedGb, platformPriceItem.tiers);

  let chargedCount = 0;

  // 账户扣费
  if (accountPrice.gt(0)) {
    await charge(
      {
        target: account,
        amount: accountPrice,
        type: chargeType,
        comment: `${commentPrefix} ${storageId} ${billingModeText} ${billedGb}GB`,
        metadata: {
          storageId,
          billingMode,
          billedGb,
          priceItemId: accountPriceItem.id,
          billingDate,
        },
      },
      em,
      currentActivatedClusters,
      logger,
      clusterPlugin,
    );
    chargedCount++;
  }

  // 租户扣费
  if (tenantPrice.gt(0)) {
    await charge(
      {
        target: tenant,
        amount: tenantPrice,
        type: chargeType,
        comment: `Tenant ${tenant.name} ${commentPrefix} ${storageId} ${billingModeText} ${billedGb}GB`,
        metadata: {
          storageId,
          billingMode,
          billedGb,
          priceItemId: platformPriceItem.id,
          billingDate,
        },
      },
      em,
      currentActivatedClusters,
      logger,
      clusterPlugin,
    );
    chargedCount++;
  }

  return chargedCount;
}

/**
 * 按账户计费
 * - USAGE: billedGb = 账户日均使用量
 * - QUOTA: billedGb = ceil(AccountStorageQuota.storageQuota ?? TenantStorageQuota.accountDefaultQuota, MB → GB)
 */
async function billingByAccount(
  billingContext: BillingContext,
  accountQuota: AccountStorageQuota | null,
  accountDefaultQuota: bigint | null | undefined,
): Promise<number> {
  const { em, storageId, billingDate, billingMode, account } = billingContext;

  let billedGb: number;

  if (billingMode === StorageBillingMode.USAGE) {
    const usageGb = await getAccountDailyUsageGb(em, account.accountName, storageId, billingDate);
    billedGb = usageGb > 0 ? Math.max(Math.ceil(usageGb), 1) : 0;
  } else {
    // 按配额：AccountStorageQuota.storageQuota ?? TenantStorageQuota.accountDefaultQuota（MB → GB）
    const quotaMb = accountQuota?.storageQuotaMb ?? accountDefaultQuota;
    if (quotaMb == null) return 0;
    const quotaGb = Number(quotaMb) / 1024;
    billedGb = quotaGb > 0 ? Math.max(Math.ceil(quotaGb), 1) : 0;
  }

  return doCharge(billingContext, billedGb, `账户${account.accountName}`);
}

async function billingForTenant(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  storageId: string,
  tenant: Tenant,
  billingDate: string,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin,
  config: NonNullable<typeof misConfig.storageBilling>,
): Promise<number> {
  let chargedCount = 0;

  // 获取平台默认价格项（租户向平台缴费）
  const platformItem = await getPlatformPriceItem(em, storageId);
  if (!platformItem) return 0;

  // 获取该租户下的所有账户
  const accounts = (await em.find(
    Account,
    {
      state: { $ne: AccountState.DELETED },
      tenant: { name: tenant.name },
    },
    { populate: ["tenant"] },
  )) as Loaded<Account, "tenant">[];

  // 获取租户默认配额
  const tenantStorageQuota = await em.findOne(TenantStorageQuota, {
    tenant: { name: tenant.name },
    storageId,
  });
  const tenantDefaultAccountQuota = tenantStorageQuota?.accountDefaultQuota;
  const accountStorageQuotaState = await em.findOne(SystemState, {
    key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
  });
  const accountStorageQuotaEnabled = accountStorageQuotaState?.value === "enabled";

  // 查找该租户适用的价格项（租户默认 > 平台默认）
  const accountPriceItem = await getAccountPriceItem(em, storageId, tenant.name, logger);
  if (!accountPriceItem) {
    logger.debug("No price item for tenant %s storageId=%s, skipping.", tenant.name, storageId);
    return 0;
  }

  if (accountPriceItem.billingMode === StorageBillingMode.QUOTA && !accountStorageQuotaEnabled) {
    logger.error(
      "Cannot bill tenant %s for storageId=%s by account quota because account storage quota is not enabled.",
      tenant.name,
      storageId,
    );
    return 0;
  }

  for (const account of accounts) {
    // 每个账户的计量方式由其适用的价格项决定
    const billingMode = accountPriceItem.billingMode;

    // 检查封锁状态
    if (account.blockedInCluster) {
      if (!config.chargeWhenBlocked) {
        logger.debug("Account %s is blocked and chargeWhenBlocked=false, skipping.", account.accountName);
        continue;
      }
      // 按配额计费：由于配额已经被清除，停止计费
      if (billingMode === StorageBillingMode.QUOTA) {
        logger.debug("Account %s is blocked and billingMode=QUOTA, skipping (quota cleared).", account.accountName);
        continue;
      }

      logger.debug("Account %s is blocked and chargeWhenBlocked=true, continuing usage billing.", account.accountName);
    }

    const billingContext: BillingContext = {
      em,
      logger,
      storageId,
      billingDate,
      billingMode,
      tenant,
      account,
      accountPriceItem,
      platformPriceItem: platformItem,
      currentActivatedClusters,
      clusterPlugin,
      config,
    };

    if (billingMode === StorageBillingMode.QUOTA) {
      const accountQuota = await em.findOne(AccountStorageQuota, { account, storageId });
      chargedCount += await billingByAccount(billingContext, accountQuota, tenantDefaultAccountQuota);
    } else {
      chargedCount += await billingByAccount(billingContext, null, tenantDefaultAccountQuota);
    }

    await em.flush();
  }

  return chargedCount;
}
