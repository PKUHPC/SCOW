import { Entity, Enum, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Tenant } from "src/entities/Tenant";
import { EntityOrRef, toRef, DATETIME_TYPE } from "src/utils/orm";

export enum StorageBillingMode {
  USAGE = "usage",
  QUOTA = "quota",
}

export interface StoragePriceTier {
  /** 阶梯起始（含），单位 TB */
  startTb: number;
  /** 兼容展示GB单位的数据 */
  startGb?: number;
  /** 单价：元/TB/天 */
  pricePerTbPerDay: number;
}

export type StorageSizeUnit = "GB" | "TB";

export interface OriginalStoragePriceTier {
  /** 用户输入的阶梯起始值 */
  startSize: number;
  /** 用户输入的阶梯结束值，undefined/null 表示无上限 */
  endSize?: number;
  /** 用户输入的单位 */
  unit: StorageSizeUnit;
  /** 单价：元/TB/天 */
  pricePerTbPerDay: number;
}

@Entity()
export class StoragePriceItem {
  @PrimaryKey()
  id!: number;

  @Property()
  storageId: string;

  @Enum({ items: () => StorageBillingMode })
  billingMode: StorageBillingMode;

  // 阶梯价格表，JSON 数组
  // 示例：[{ startTb: 0, pricePerTbPerDay: 0 }, { startTb: 50, pricePerTbPerDay: 1.5 }]
  // 阶梯结束值 = 下一个阶梯的 startTb；最后一个阶梯无上限
  @Property({ type: "json" })
  tiers: StoragePriceTier[];

  @Property({ type: "json", nullable: true })
  originalTiers?: OriginalStoragePriceTier[];

  // 所属租户，null = 平台默认价格
  @ManyToOne(() => Tenant, { ref: true, nullable: true })
  tenant?: Ref<Tenant>;

  @Property({ columnType: DATETIME_TYPE })
  createTime: Date;

  @Property({ default: "" })
  description: string;

  constructor(init: {
    storageId: string;
    billingMode: StorageBillingMode;
    tiers: StoragePriceTier[];
    originalTiers?: OriginalStoragePriceTier[];
    tenant?: EntityOrRef<Tenant>;
    description?: string;
  }) {
    this.storageId = init.storageId;
    this.billingMode = init.billingMode;
    this.tiers = init.tiers;
    this.originalTiers = init.originalTiers;
    this.createTime = new Date();
    this.description = init.description ?? "";
    this.tenant = init.tenant ? toRef(init.tenant) : undefined;
  }
}
