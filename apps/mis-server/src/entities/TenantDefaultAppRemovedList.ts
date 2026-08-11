import { Entity, Enum, ManyToOne, PrimaryKey, Property, Ref, Unique } from "@mikro-orm/core";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";

import { AppScope } from "./AppScope";

@Entity()
@Unique({
  name: "uk_cluster_tenant_scope_app",
  // 查询通常同时限定集群、租户、scope 和 appId；四列均为等值条件。
  properties: ["cluster", "tenant", "appScope", "appId"],
})
export class TenantDefaultAppRemovedList {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { ref: true, nullable: false })
  tenant: Ref<Tenant>;

  @Property({ columnType: "varchar(255)", nullable: false })
  appId: string;

  @Enum({ items: () => AppScope, comment: Object.values(AppScope).join(", ") })
  appScope: AppScope;

  @ManyToOne(() => Cluster, { deleteRule: "cascade", ref: true, nullable: false })
  cluster: Ref<Cluster>;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  removedAt: Date;

  constructor(init: {
    appId: string;
    appScope: AppScope;
    cluster: EntityOrRef<Cluster>;
    tenant: EntityOrRef<Tenant>;
    removedAt?: Date;
  }) {
    this.tenant = toRef(init.tenant);
    this.appId = init.appId;
    this.appScope = init.appScope;
    this.cluster = toRef(init.cluster);
    this.removedAt = init.removedAt ?? new Date();
  }
}
