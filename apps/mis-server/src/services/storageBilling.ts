import { plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { QueryOrder } from "@mikro-orm/core";
import { moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import {
  StorageBillingServiceServer,
  StorageBillingServiceService,
  StorageBillingMode as ProtoBillingMode,
} from "@scow/protos/build/server/storage_billing";
import {
  OriginalStoragePriceTier,
  StorageBillingMode,
  StoragePriceItem,
  StoragePriceTier,
} from "src/entities/StoragePriceItem";
import { Tenant } from "src/entities/Tenant";

function protoModeToBillingMode(mode: ProtoBillingMode): StorageBillingMode {
  switch (mode) {
    case ProtoBillingMode.STORAGE_BILLING_MODE_USAGE:
      return StorageBillingMode.USAGE;
    case ProtoBillingMode.STORAGE_BILLING_MODE_QUOTA:
      return StorageBillingMode.QUOTA;
    default:
      throw { code: status.INVALID_ARGUMENT, message: "Invalid billing mode" };
  }
}

function billingModeToProto(mode: StorageBillingMode): ProtoBillingMode {
  return mode === StorageBillingMode.USAGE
    ? ProtoBillingMode.STORAGE_BILLING_MODE_USAGE
    : ProtoBillingMode.STORAGE_BILLING_MODE_QUOTA;
}

function entityToProto(item: StoragePriceItem) {
  const tiers = item.tiers.map((t) => ({
    startTb: t.startTb ?? (t.startGb ?? 0) / 1024,
    pricePerTbPerDay: numberToMoney(t.pricePerTbPerDay),
  }));
  const originalTiers = item.originalTiers?.map((t) => ({
    startSize: t.startSize,
    endSize: t.endSize,
    unit: t.unit,
    pricePerTbPerDay: numberToMoney(t.pricePerTbPerDay),
  })) ?? tiers.map((tier, i) => ({
    startSize: tier.startTb,
    endSize: tiers[i + 1]?.startTb,
    unit: "TB",
    pricePerTbPerDay: tier.pricePerTbPerDay,
  }));

  return {
    id: item.id,
    storageId: item.storageId,
    billingMode: billingModeToProto(item.billingMode),
    tiers,
    tenantName: item.tenant?.getProperty("name"),
    createTime: item.createTime.toISOString(),
    description: item.description,
    originalTiers,
  };
}

const storageSizeToTb = (value: number, unit: string) => unit === "GB" ? value / 1024 : value;

export const storageBillingServiceServer = plugin((server) => {

  server.addService<StorageBillingServiceServer>(StorageBillingServiceService, {

    getStorageBillingItems: async ({ request, em }) => {
      const { storageId, tenantName } = request;

      const items = await em.find(StoragePriceItem, {
        storageId,
        ...(tenantName != null
          ? { tenant: { name: tenantName } }
          : { tenant: null }),
      }, {
        orderBy: { createTime: QueryOrder.DESC },
        populate: ["tenant"],
      });

      // active = createTime 最大的那条；其余为 history
      const activeItems: StoragePriceItem[] = [];
      const historyItems: StoragePriceItem[] = [];

      if (items.length > 0) {
        activeItems.push(items[0]);
        for (let i = 1; i < items.length; i++) {
          historyItems.push(items[i]);
        }
      }

      return [{
        activeItems: activeItems.map(entityToProto),
        historyItems: historyItems.map(entityToProto),
      }];
    },

    addStorageBillingItem: async ({ request, em, logger }) => {
      const {
        storageId,
        billingMode: protoBillingMode,
        tiers,
        originalTiers,
        tenantName,
        description,
      } = request;

      const billingMode = protoModeToBillingMode(protoBillingMode);
      const tiersToValidate = originalTiers.length > 0
        ? originalTiers.map((t) => ({
          startTb: storageSizeToTb(t.startSize, t.unit),
          pricePerTbPerDay: t.pricePerTbPerDay,
        }))
        : tiers;

      // 校验 tiers
      if (tiersToValidate.length === 0) {
        throw { code: status.INVALID_ARGUMENT, message: "Tiers cannot be empty" };
      }

      if (tiersToValidate[0].startTb !== 0) {
        throw { code: status.INVALID_ARGUMENT, message: "First tier must start at 0 TB" };
      }

      for (let i = 1; i < tiersToValidate.length; i++) {
        if (tiersToValidate[i].startTb <= tiersToValidate[i - 1].startTb) {
          throw {
            code: status.INVALID_ARGUMENT,
            message: `Tier ${i} startTb must be greater than tier ${i - 1} startTb`,
          };
        }
      }

      for (const tier of tiersToValidate) {
        const price = tier.pricePerTbPerDay ? moneyToNumber(tier.pricePerTbPerDay) : 0;
        if (price < 0) {
          throw { code: status.INVALID_ARGUMENT, message: "Price must be >= 0" };
        }
      }

      for (let i = 0; i < originalTiers.length; i++) {
        const tier = originalTiers[i];
        if (tier.unit !== "GB" && tier.unit !== "TB") {
          throw { code: status.INVALID_ARGUMENT, message: "Tier unit must be GB or TB" };
        }
        if (tier.endSize != null && tier.endSize <= tier.startSize) {
          throw { code: status.INVALID_ARGUMENT, message: "Tier endSize must be greater than startSize" };
        }
        if (i === originalTiers.length - 1 && tier.endSize != null) {
          throw { code: status.INVALID_ARGUMENT, message: "Last tier must be unlimited" };
        }
      }

      // 获取租户实体
      let tenant: Tenant | undefined;
      if (tenantName) {
        const found = await em.findOne(Tenant, { name: tenantName });
        if (!found) {
          throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} not found` };
        }
        tenant = found;
      }

      // 转换 tiers
      const tierEntities: StoragePriceTier[] = tiersToValidate.map((t) => ({
        startTb: t.startTb,
        pricePerTbPerDay: t.pricePerTbPerDay ? moneyToNumber(t.pricePerTbPerDay) : 0,
      }));
      const originalTierEntities: OriginalStoragePriceTier[] = originalTiers.length > 0
        ? originalTiers.map((t) => ({
          startSize: t.startSize,
          endSize: t.endSize,
          unit: t.unit as OriginalStoragePriceTier["unit"],
          pricePerTbPerDay: t.pricePerTbPerDay ? moneyToNumber(t.pricePerTbPerDay) : 0,
        }))
        : tierEntities.map((t, i) => ({
          startSize: t.startTb,
          endSize: tierEntities[i + 1]?.startTb,
          unit: "TB",
          pricePerTbPerDay: t.pricePerTbPerDay,
        }));

      const item = new StoragePriceItem({
        storageId,
        billingMode,
        tiers: tierEntities,
        originalTiers: originalTierEntities,
        tenant,
        description: description ?? "",
      });

      em.persist(item);
      await em.flush();

      logger.info("Created storage billing item id=%d for storageId=%s", item.id, storageId);

      return [{ id: item.id }];
    },
  });
});
