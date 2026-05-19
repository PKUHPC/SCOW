import { EntitySchema } from "@mikro-orm/core";
import { DATETIME_TYPE } from "src/utils/orm";

export class TenantPartitionRule {
  id!: number;
  tenantName: string;
  clusterId: string;
  // 分区名称，同一集群下分区唯一标识符
  partition: string;
  isAccountDefaultPartition: boolean;
  createTime = new Date();
  updateTime = new Date();

  constructor(init: { tenantName: string; clusterId: string; partition: string; isAccountDefaultPartition: boolean }) {
    this.tenantName = init.tenantName;
    this.clusterId = init.clusterId;
    this.partition = init.partition;
    this.isAccountDefaultPartition = init.isAccountDefaultPartition;
  }
}

export const TenantPartitionRuleSchema = new EntitySchema<TenantPartitionRule>({
  class: TenantPartitionRule,
  tableName: "tenant_partition_rule",
  properties: {
    id: { type: "number", primary: true },
    tenantName: { type: String, length: 255, index: true },
    clusterId: { type: String, length: 255 },
    partition: { type: String, length: 255 },
    isAccountDefaultPartition: { type: "boolean", default: false },
    createTime: { type: "date", columnType: DATETIME_TYPE },
    updateTime: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
});
