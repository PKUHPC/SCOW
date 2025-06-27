import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Tenant } from "src/entities/Tenant";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
export class TenantStorageQuota {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { deleteRule: "cascade", ref: true, nullable: false })
  tenant: Ref<Tenant>;

  @Index({ name: "idx_cluster" })
  @Property({ nullable: false })
  cluster: string;

  @Index({ name: "idx_path" })
  @Property({ nullable: false, comment: "存储挂载目录" })
  path: string;

  // 存储为 bytes
  @Property({ columnType: "bigint", comment: "租户下用户默认的存储配额" })
  userDefaultQuota: bigint;

  constructor(init: {
    tenant: EntityOrRef<Tenant>;
    cluster: string,
    userDefaultQuota: bigint,
    path: string,
  }) {
    this.tenant = toRef(init.tenant);
    this.cluster = init.cluster;
    this.path = init.path;
    this.userDefaultQuota = init.userDefaultQuota;
  }

}
