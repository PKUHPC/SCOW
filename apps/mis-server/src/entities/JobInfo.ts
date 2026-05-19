import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { JobInfo as ClusterJobInfo } from "@scow/scheduler-adapter-protos/build/job";
import { DECIMAL_DEFAULT_RAW, DecimalType } from "src/utils/decimal";

const UNKNOWN_PRICE_ITEM = "UNKNOWN";

export interface JobPriceInfo {
  tenant: { billingItemId: string; price: Decimal } | undefined;
  account: { billingItemId: string; price: Decimal } | undefined;
}

@Entity()
export class JobInfo {
  @PrimaryKey()
  biJobIndex!: number;

  @Property({ index: "idJob" })
  idJob!: number;

  @Property({ length: 255, comment: "账户", index: "account" })
  account!: string;

  @Property({ length: 127, comment: "用户名", index: "user" })
  user!: string;

  @Property({ length: 255, columnType: "tinytext", comment: "分区" })
  partition!: string;

  @Property({ columnType: "text", comment: "使用节点列表" })
  nodelist!: string;

  @Property({ length: 255, columnType: "tinytext", comment: "作业名" })
  jobName!: string;

  // 这里存的是scow中的集群名
  @Property({ length: 50, comment: "集群名" })
  cluster!: string;

  @Index({ name: "time_submit" })
  @Property({ comment: "提交时间" })
  timeSubmit!: Date;

  @Index({ name: "time_start" })
  @Property({ comment: "开始时间", nullable: true })
  timeStart?: Date;

  @Property({ comment: "结束时间", index: "time_end" })
  timeEnd!: Date;

  @Property({ columnType: "int(10)", comment: "使用GPU数。来自gres_req字段" })
  gpu!: number;

  @Property({ columnType: "int unsigned", comment: "申请CPU数tres_req" })
  cpusReq!: number;

  @Property({ columnType: "int unsigned", comment: "申请的内存，单位MB，来自tres_req" })
  memReq!: number;

  @Property({ columnType: "int unsigned", comment: "申请节点数,tres_req" })
  nodesReq!: number;

  @Property({ columnType: "int unsigned", comment: "分配CPU数tres_alloc" })
  cpusAlloc!: number;

  @Property({ columnType: "int unsigned", comment: "分配的内存，单位MB，来自tres_alloc" })
  memAlloc!: number;

  @Property({ columnType: "int unsigned", comment: "分配节点数tres_alloc" })
  nodesAlloc!: number;

  @Property({ columnType: "int unsigned", comment: "作业时间限制" })
  timelimit!: number;

  @Index({ name: "time_used" })
  @Property({ columnType: "bigint unsigned", comment: "作业执行时间" })
  timeUsed!: number;

  @Index({ name: "time_wait" })
  @Property({ columnType: "bigint unsigned", comment: "作业等待时间" })
  timeWait!: number;

  @Property({ length: 255, comment: "QOS" })
  qos!: string;

  @Index({ name: "record_time" })
  @Property({ columnType: "timestamp", defaultRaw: "CURRENT_TIMESTAMP", comment: "记录时间" })
  recordTime!: Date;

  @Property()
  tenant: string;

  @Property({ default: UNKNOWN_PRICE_ITEM })
  accountBillingItemId: string;

  @Property({ default: UNKNOWN_PRICE_ITEM })
  tenantBillingItemId: string;

  @Property({ type: DecimalType, defaultRaw: DECIMAL_DEFAULT_RAW })
  tenantPrice: Decimal = new Decimal(0);

  @Property({ type: DecimalType, defaultRaw: DECIMAL_DEFAULT_RAW })
  accountPrice: Decimal = new Decimal(0);

  constructor(job: { cluster: string } & ClusterJobInfo, tenant: string | undefined, jobPriceInfo: JobPriceInfo) {
    this.idJob = job.jobId;

    this.account = job.account;
    this.tenant = tenant ?? "";

    this.user = job.user;
    this.partition = job.partition;
    this.nodelist = job.nodeList!;
    this.jobName = job.name;
    this.cluster = job.cluster;
    this.gpu = job.gpusAlloc!;
    this.cpusReq = job.cpusReq;
    this.memReq = job.memReqMb;
    this.nodesReq = job.nodesReq;
    this.cpusAlloc = job.cpusAlloc!;
    this.memAlloc = job.memAllocMb!;
    this.nodesAlloc = job.nodesAlloc!;
    this.timelimit = job.timeLimitMinutes;
    this.timeUsed = job.elapsedSeconds!;
    this.timeWait = job.startTime
      ? (new Date(job.startTime).getTime() - new Date(job.submitTime!).getTime()) / 1000
      : (new Date(job.endTime!).getTime() - new Date(job.submitTime!).getTime()) / 1000;
    this.qos = job.qos;

    this.tenantPrice = jobPriceInfo.tenant?.price ?? new Decimal(0);
    this.tenantBillingItemId = jobPriceInfo.tenant?.billingItemId ?? UNKNOWN_PRICE_ITEM;
    this.accountPrice = jobPriceInfo.account?.price ?? new Decimal(0);
    this.accountBillingItemId = jobPriceInfo.account?.billingItemId ?? UNKNOWN_PRICE_ITEM;

    this.timeSubmit = new Date(job.submitTime!);
    this.timeStart = job.startTime ? new Date(job.startTime) : undefined;
    this.timeEnd = new Date(job.endTime!);
  }
}
