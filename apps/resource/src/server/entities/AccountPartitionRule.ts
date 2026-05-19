import { EntitySchema } from "@mikro-orm/core";
import { DATETIME_TYPE } from "src/utils/orm";

export class AccountPartitionRule {
  id!: number;
  accountName: string;
  tenantName: string;
  clusterId: string;
  partition: string;
  createTime = new Date();
  updateTime = new Date();

  constructor(init: { accountName: string; tenantName: string; clusterId: string; partition: string }) {
    this.accountName = init.accountName;
    this.tenantName = init.tenantName;
    this.clusterId = init.clusterId;
    this.partition = init.partition;
  }
}

export const AccountPartitionRuleSchema = new EntitySchema<AccountPartitionRule>({
  class: AccountPartitionRule,
  tableName: "account_partition_rule",
  properties: {
    id: { type: "number", primary: true },
    accountName: { type: String, length: 255, nullable: false },
    tenantName: { type: String, length: 255, nullable: false },
    clusterId: { type: String, length: 255 },
    partition: { type: String, length: 255 },
    createTime: { type: "date", columnType: DATETIME_TYPE },
    updateTime: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
  indexes: [
    {
      // 添加索引以提高按 租户+账户名+集群 或 租户+账户名 查询的性能
      properties: ["tenantName", "accountName", "clusterId"],
      name: "idx_tenant_account_cluster",
    },
    {
      // 添加索引以提高按 租户+集群+分区 或 租户+集群 查询的性能
      properties: ["tenantName", "clusterId", "partition"],
      name: "idx_tenant_cluster_partition",
    },
  ],
});
