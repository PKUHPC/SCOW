import { EntitySchema } from "@mikro-orm/core";
import { DATETIME_TYPE } from "src/utils/orm";

export class AccountClusterRule {
  id!: number;
  accountName: string;
  tenantName: string;
  clusterId: string;
  createTime = new Date();
  updateTime = new Date();

  constructor(init: { accountName: string; tenantName: string; clusterId: string }) {
    this.accountName = init.accountName;
    this.tenantName = init.tenantName;
    this.clusterId = init.clusterId;
  }
}

export const AccountClusterRuleSchema = new EntitySchema<AccountClusterRule>({
  class: AccountClusterRule,
  tableName: "account_cluster_rule",
  properties: {
    id: { type: "number", primary: true },
    accountName: { type: String, length: 255, nullable: false },
    tenantName: { type: String, length: 255, nullable: false },
    clusterId: { type: String, length: 255 },
    createTime: { type: "date", columnType: DATETIME_TYPE },
    updateTime: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
});
