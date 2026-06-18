import { Entity, Enum, Index, PrimaryKey, Property, Unique } from "@mikro-orm/core";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/utils/orm";

import { MaxTimeUnit } from "./JobTemplate";

@Entity()
@Unique({ name: "uk_user_app_template_cluster", properties: ["userId", "templateName", "cluster", "appId"] })
@Index({ name: "idx_list_app_template", properties: ["userId", "cluster", "appId"] })
export class AppTemplate {
  @PrimaryKey()
  id!: number;

  @Property()
  userId: string;

  @Property({ length: 50 })
  cluster: string;

  @Property({ length: 100 })
  templateName: string;

  @Property()
  account: string;

  @Property()
  partition: string;

  @Property()
  qos: string;

  @Property()
  nodeCount: number;

  @Property()
  coreCount: number;

  @Property()
  gpuCount: number;

  @Property({ comment: "最大运行时间（原始值）" })
  maxTime: number;

  @Enum({ items: () => MaxTimeUnit, default: MaxTimeUnit.MINUTE, comment: Object.values(MaxTimeUnit).join(", ") })
  maxTimeUnit: MaxTimeUnit;

  @Property({ nullable: true, comment: "内存（MB）" })
  memoryMb?: number;

  @Property({ length: 50 })
  appId: string;

  @Property({ type: "json", nullable: true })
  customAttributes?: Record<string, string>;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  createdAt: Date;

  @Property({ columnType: DATETIME_TYPE, nullable: true, onUpdate: () => new Date() })
  updatedAt?: Date;

  constructor(init: {
    userId: string;
    cluster: string;
    templateName: string;
    account: string;
    partition: string;
    qos: string;
    nodeCount: number;
    coreCount: number;
    gpuCount: number;
    maxTime: number;
    maxTimeUnit?: MaxTimeUnit;
    memoryMb?: number;
    appId: string;
    customAttributes?: Record<string, string>;
  }) {
    this.userId = init.userId;
    this.cluster = init.cluster;
    this.templateName = init.templateName;
    this.account = init.account;
    this.partition = init.partition;
    this.qos = init.qos;
    this.nodeCount = init.nodeCount;
    this.coreCount = init.coreCount;
    this.gpuCount = init.gpuCount;
    this.maxTime = init.maxTime;
    this.maxTimeUnit = init.maxTimeUnit ?? MaxTimeUnit.MINUTE;
    this.memoryMb = init.memoryMb;
    this.appId = init.appId;
    this.customAttributes = init.customAttributes;
    this.createdAt = new Date();
  }
}
