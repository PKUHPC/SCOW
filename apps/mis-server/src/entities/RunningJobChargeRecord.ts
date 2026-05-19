import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { DECIMAL_DEFAULT_RAW, DecimalType } from "src/utils/decimal";
import { DATETIME_TYPE } from "src/utils/orm";

const UNKNOWN_PRICE_ITEM = "UNKNOWN";

@Entity()
@Index({ name: "query", properties: ["cluster", "jobId"] })
export class RunningJobChargeRecord {
  @PrimaryKey()
  id!: number;

  @Property({ comment: "集群ID" })
  cluster: string;

  @Property({ comment: "作业ID" })
  jobId: number;

  @Property({ columnType: DATETIME_TYPE, comment: "开始时间" })
  startTime: Date;

  @Property({ default: UNKNOWN_PRICE_ITEM, comment: "平台计费项ID" })
  tenantBillingItemId: string;

  @Property({ default: UNKNOWN_PRICE_ITEM, comment: "租户计费项ID" })
  accountBillingItemId: string;

  @Property({ type: DecimalType, defaultRaw: DECIMAL_DEFAULT_RAW })
  tenantPrice: Decimal = new Decimal(0);

  @Property({ type: DecimalType, defaultRaw: DECIMAL_DEFAULT_RAW })
  accountPrice: Decimal = new Decimal(0);

  @Property({ columnType: DATETIME_TYPE, comment: "上一次计费时间" })
  lastChargeTime: Date;

  constructor(init: {
    id?: number;
    cluster: string;
    jobId: number;
    startTime: Date;
    tenantBillingItemId: string;
    accountBillingItemId: string;
    tenantPrice: Decimal;
    accountPrice: Decimal;
    lastChargeTime: Date;
  }) {
    if (init.id) {
      this.id = init.id;
    }
    this.cluster = init.cluster;
    this.jobId = init.jobId;
    this.startTime = init.startTime;
    this.tenantBillingItemId = init.tenantBillingItemId;
    this.accountBillingItemId = init.accountBillingItemId;
    this.tenantPrice = init.tenantPrice;
    this.accountPrice = init.accountPrice;
    this.lastChargeTime = init.lastChargeTime;
  }
}
