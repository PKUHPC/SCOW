import { Entity, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";

@Entity()
export class TenantDefaultAppRemovedList {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { ref: true, nullable: false })
  tenant: Ref<Tenant>;

  @Property({ columnType: "varchar(255)", nullable: false })
  appId: string;

  @ManyToOne(() => Cluster, { deleteRule: "cascade", ref: true, nullable: false })
  cluster: Ref<Cluster>;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  removedAt: Date;

  constructor(init: { appId: string; cluster: EntityOrRef<Cluster>; tenant: EntityOrRef<Tenant>; removedAt?: Date }) {
    this.tenant = toRef(init.tenant);
    this.appId = init.appId;
    this.cluster = toRef(init.cluster);
    this.removedAt = init.removedAt ?? new Date();
  }
}
