import { EntitySchema } from "@mikro-orm/core";
import { DATETIME_TYPE } from "src/utils/orm";

export class TenantClusterRule {
  id!: number;
  tenantName: string;
  clusterId: string;
  isAccountDefaultCluster: boolean;
  createTime = new Date();
  updateTime = new Date();

  constructor(init: { tenantName: string; clusterId: string; isAccountDefaultCluster: boolean }) {
    this.tenantName = init.tenantName;
    this.clusterId = init.clusterId;
    this.isAccountDefaultCluster = init.isAccountDefaultCluster;
  }
}

export const TenantClusterRuleSchema = new EntitySchema<TenantClusterRule>({
  class: TenantClusterRule,
  tableName: "tenant_cluster_rule",
  properties: {
    id: { type: "number", primary: true },
    tenantName: { type: String, length: 255, index: true },
    clusterId: { type: String, length: 255 },
    isAccountDefaultCluster: { type: "boolean", default: false },
    createTime: { type: "date", columnType: DATETIME_TYPE },
    updateTime: { type: "date", columnType: DATETIME_TYPE, onUpdate: () => new Date() },
  },
});
