import { Entity, Enum, PrimaryKey, Property, Unique } from "@mikro-orm/core";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/utils/orm";

export enum MaxTimeUnit {
  MINUTE = "MINUTE",
  HOUR = "HOUR",
  DAY = "DAY",
}

@Entity()
@Unique({ name: "uk_user_job_template_name", properties: ["userId", "templateName"] })
export class JobTemplate {
  @PrimaryKey()
  id!: number;

  @Property()
  userId: string;

  @Property()
  cluster: string;

  @Property()
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

  @Property({ nullable: true, type: "text" })
  command?: string;

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
    command?: string;
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
    this.command = init.command;
    this.createdAt = new Date();
  }
}
