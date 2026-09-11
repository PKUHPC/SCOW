import { Logger } from "@ddadaal/tsgrpc-server";
import { QueryOrder } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal } from "@scow/lib-decimal";
import { StoragePriceItem, StoragePriceTier } from "src/entities/StoragePriceItem";

/**
 * 查找账户计费适用的价格项
 * 优先级：租户默认(tenant匹配) > 平台默认(tenant=null)
 * 同级别取 createTime 最大的
 */
export async function getAccountPriceItem(
  em: SqlEntityManager<MySqlDriver>,
  storageId: string,
  tenantName: string,
  logger: Logger,
): Promise<StoragePriceItem | null> {

  // 1. 尝试查找租户默认价格
  const tenantDefault = await em.findOne(StoragePriceItem, {
    storageId,
    tenant: { name: tenantName },
  }, { orderBy: { createTime: QueryOrder.DESC } });

  if (tenantDefault) {
    logger.debug("Found tenant default price item id=%d for %s", tenantDefault.id, tenantName);
    return tenantDefault;
  }

  // 2. 兜底到平台默认价格
  const platformDefault = await em.findOne(StoragePriceItem, {
    storageId,
    tenant: null,
  }, { orderBy: { createTime: QueryOrder.DESC } });

  if (platformDefault) {
    logger.debug("Found platform default price item id=%d for %s", platformDefault.id, tenantName);
  }

  return platformDefault;
}

/**
 * 查找租户向平台缴费的价格项（只用平台默认价格，tenant=null）
 * 取 createTime 最大的
 */
export async function getPlatformPriceItem(
  em: SqlEntityManager<MySqlDriver>,
  storageId: string,
): Promise<StoragePriceItem | null> {
  return em.findOne(StoragePriceItem, {
    storageId,
    tenant: null,
  }, { orderBy: { createTime: QueryOrder.DESC } });
}

/**
 * 阶梯计费计算
 * @param billedGb 计费用量（GB，已向上取整）
 * @param tiers 阶梯价格表，按 startTb 升序排列，价格为 元/TB/天
 * @returns 金额（Decimal）
 */
export function calculateTieredPrice(billedGb: number, tiers: StoragePriceTier[]): Decimal {
  if (tiers.length === 0 || billedGb <= 0) {
    return new Decimal(0);
  }

  const getTierStartTb = (tier: StoragePriceTier) => tier.startTb ?? (tier.startGb ?? 0) / 1024;
  const getTierStartGb = (tier: StoragePriceTier) => getTierStartTb(tier) * 1024;
  const sorted = [...tiers].sort((a, b) => getTierStartTb(a) - getTierStartTb(b));

  let total = new Decimal(0);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const tierStartGb = getTierStartGb(tier);
    if (billedGb <= tierStartGb) break;

    const nextStartGb = i + 1 < sorted.length ? getTierStartGb(sorted[i + 1]) : Infinity;
    const gbInTier = Math.min(billedGb, nextStartGb) - tierStartGb;
    const tbInTier = new Decimal(gbInTier).dividedBy(1024);
    const tierCharge = tbInTier.multipliedBy(new Decimal(tier.pricePerTbPerDay));
    total = total.plus(tierCharge);
  }

  return total;
}
