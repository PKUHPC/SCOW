import { Logger } from "@ddadaal/tsgrpc-server";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { getConfigFromFile } from "@scow/lib-config";
import { Decimal } from "@scow/lib-decimal";
import { Static, Type } from "@sinclair/typebox";
import { AmountStrategy, JobPriceItem } from "src/entities/JobPriceItem";
import { Tenant } from "src/entities/Tenant";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { toRef } from "src/utils/orm";

const Item = Type.Object({
  id: Type.String({ description: "计费项ID" }),
  amount: Type.Enum(AmountStrategy, { description: "作业用量算法" }),
  price: Type.String({ description: "费用" }),
});

const TenantSpecificSchema = Type.Record(
  Type.String({ description: "集群名" }),
  Type.Record(
    Type.String({ description: "分区名" }),
    Type.Union([Item, Type.Record(Type.String({ description: "QOS" }), Item)]),
  ),
);

const PriceItemsJsonSchema = Type.Record(
  Type.String({ description: `所属租户。如果为${DEFAULT_TENANT_NAME}则为默认租户` }),
  TenantSpecificSchema);


export async function createPriceItems(em: SqlEntityManager, logger: Logger) {

  const priceItems = getConfigFromFile(PriceItemsJsonSchema, "priceItems", DEFAULT_CONFIG_BASE_PATH);

  logger.info("priceItems.json content: %o", priceItems);

  const priceItemEntities = new Map<string, JobPriceItem>();

  interface Info {
    cluster: string;
    partition: string;
    qos?: string;
    tenant: string;
  }

  const tenants = await em.find(Tenant, { });

  function addEntity(itemId: string, price: string, amount: AmountStrategy, info: Info) {
    if (priceItemEntities.has(itemId)) {
      throw new Error(`Multiple occurrences of ${itemId} detected.`);
    }

    const entity = new JobPriceItem({
      itemId,
      price: new Decimal(price),
      amount: amount,
      path: [info.cluster, info.partition, ...info.qos ? [info.qos] : [] ],
    });

    if (info.tenant !== DEFAULT_TENANT_NAME) {
      let tenant = tenants.find((x) => x.name === info.tenant);
      if (!tenant) {
        tenant = new Tenant({ name: info.tenant });
        logger.info("Creating new tenant %s.", info.tenant);
        tenants.push(tenant);
      }

      entity.tenant = toRef(tenant);
    }

    em.persist(entity);

    priceItemEntities.set(itemId, entity);
  }

  for (const tenant in priceItems) {
    for (const cluster in priceItems[tenant]) {
      for (const partition in priceItems[tenant][cluster]) {
        const item = priceItems[tenant][cluster][partition];

        if (typeof item.id === "string") {
          const { id, price, amount } = item as Static<typeof Item>;
          addEntity(id, price, amount, { cluster, partition, tenant });
        } else {
          for (const q in item) {
            const i = item[q] as Static<typeof Item>;
            addEntity(i.id, i.price, i.amount, { cluster, partition, qos: q, tenant });
          }
        }
      }
    }
  }

  const entities = Array.from(priceItemEntities.values());

  await em.persistAndFlush(entities);
  logger.info("Successfully saved items: %o", entities);
}

