import { Entity, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";

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

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  disabledAt: Date;

  @ManyToOne(() => User, { deleteRule: "set null", ref: true, nullable: true })
  operator?: Ref<User>;

  constructor(init: {
    appId: string;
    cluster: EntityOrRef<Cluster>;
    tenant: EntityOrRef<Tenant>;
    operator?: EntityOrRef<User>;
    disabledAt?: Date;
  }) {
    this.tenant = toRef(init.tenant);
    this.appId = init.appId;
    this.cluster = toRef(init.cluster);
    if (init.operator) {
      this.operator = toRef(init.operator);
    }
    this.disabledAt = init.disabledAt ?? new Date();
  }
}
