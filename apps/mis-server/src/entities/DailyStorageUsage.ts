import { Entity, Index, PrimaryKey, Property, Unique } from "@mikro-orm/core";

@Entity()
@Unique({ properties: ["userId", "storageId", "date"] })
@Unique({ properties: ["accountName", "storageId", "date"] })
@Index({ properties: ["storageId", "date"] })
export class DailyStorageUsage {
  @PrimaryKey()
  id!: number;

  @Index()
  @Property({ nullable: true, comment: "用户 ID" })
  userId?: string | null;

  @Index()
  @Property({ nullable: true, comment: "账户名称" })
  accountName?: string | null;

  // 兼容字段：记录最近一次落到文件系统执行时使用的 cluster
  @Property({ nullable: false })
  cluster: string;

  @Index({ name: "idx_daily_storage_usage_storage_id" })
  @Property({ nullable: false, comment: "文件系统 storageId" })
  storageId: string;

  // 日期（东八区），格式 "YYYY-MM-DD"
  @Property({ nullable: false, comment: "日期（东八区 YYYY-MM-DD）" })
  date: string;

  // 当天每次定时同步时记录的使用量，单位 GB，保留2位小数
  @Property({ type: "json", comment: "当天各次采样用量(GB)，保留2位小数" })
  usages: number[];

  // 当天日均用量，由 0 点计费任务计算 = ceil(avg(usages))
  // 采用进一法（向上取整），不保留小数，单位 GB
  @Property({ nullable: true, comment: "日均用量(GB)，进一法取整" })
  averageUsage?: number;

  constructor(init: {
    userId?: string | null;
    accountName?: string | null;
    cluster: string;
    storageId: string;
    date: string;
    usages: number[];
  }) {
    this.userId = init.userId ?? null;
    this.accountName = init.accountName ?? null;
    this.cluster = init.cluster;
    this.storageId = init.storageId;
    this.date = init.date;
    this.usages = init.usages;
  }
}
