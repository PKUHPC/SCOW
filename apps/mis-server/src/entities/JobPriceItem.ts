import { ArrayType, Entity, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { Tenant } from "src/entities/Tenant";
import { DecimalType } from "src/utils/decimal";
import { DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";

export enum AmountStrategy {
  MAX_CPUSALLOC_MEM = "max-cpusAlloc-mem",
  MAX_GPU_CPUSALLOC = "max-gpu-cpusAlloc",
  GPU = "gpu",
  CPUS_ALLOC = "cpusAlloc",
}

@Entity()
export class JobPriceItem {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  itemId: string;

  @Property({ type: ArrayType, comment: "集群,分区[,qos]" })
  path: string[];

  @Property()
  description: string;

  @ManyToOne(() => Tenant, { ref: true, nullable: true })
  tenant?: Ref<Tenant>;

  @Property({ type: DecimalType })
  price: Decimal;

  @Property({ comment: Object.values(AmountStrategy).join(", ") })
  amount: string;

  @Property({ columnType: DATETIME_TYPE })
  createTime: Date;

  constructor(init: {
    itemId: string;
    path: string[];
    price: Decimal;
    amount: string;
    description?: string;
    tenant?: EntityOrRef<Tenant>;
  }) {
    this.price = init.price;
    this.path = init.path;
    this.itemId = init.itemId;
    this.amount = init.amount;
    this.createTime = new Date();
    this.description = init.description ?? "";
    this.tenant = init.tenant ? toRef(init.tenant) : undefined;
  }
}
