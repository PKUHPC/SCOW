import { Entity, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
export class TenantAppBlacklist {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { ref: true, nullable: false })
  tenant: Ref<Tenant>;

  @Property({ columnType: "varchar(255)", nullable: false })
  appId: string;

  @ManyToOne(() => Cluster, { deleteRule: "cascade", ref: true, nullable: false })
  cluster: Ref<Cluster>;

  @Property({ defaultRaw: "CURRENT_TIMESTAMP" })
  disabledAt: Date = new Date();

  @ManyToOne(() => User, { deleteRule: "set null", ref: true, nullable: true })
  operator?: Ref<User>;

  constructor(init: {
    appId: string,
    cluster: EntityOrRef<Cluster>,
    tenant: EntityOrRef<Tenant>,
    operator?: EntityOrRef<User>,
  }) {
    this.tenant = toRef(init.tenant);
    this.appId = init.appId;
    this.cluster = toRef(init.cluster);
    if (init.operator) {
      this.operator = toRef(init.operator);
    }
    this.disabledAt = new Date();
  }
}
