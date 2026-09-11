import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from "@mikro-orm/core";
import { Tenant } from "src/entities/Tenant";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
@Unique({ properties: ["tenant", "storageId"] })
export class TenantStorageQuota {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { deleteRule: "cascade", ref: true, nullable: false })
  tenant: Ref<Tenant>;

  // 兼容字段：记录最近一次落到文件系统执行时使用的 cluster，
  // 不再作为租户默认配额的业务主键。
  @Index({ name: "idx_cluster" })
  @Property({ nullable: false })
  cluster: string;

  // 兼容字段：记录最近一次落到文件系统执行时使用的 mountPath，
  // 不再作为租户默认配额的业务主键。
  @Index({ name: "idx_path" })
  @Property({ nullable: false, comment: "存储挂载目录" })
  path: string;

  @Index({ name: "idx_storage_id" })
  @Property({ nullable: false, comment: "文件系统 storageId" })
  storageId: string;

  // 存储为 MB
  @Property({ columnType: "bigint", comment: "租户下用户默认的存储配额（MB）" })
  userDefaultQuota: bigint;

  // 账户默认存储配额，null 表示使用文件系统总量，单位 MB
  @Property({ columnType: "bigint", nullable: true, comment: "租户下账户默认的存储配额，单位 MB，null 表示使用默认值" })
  accountDefaultQuota: bigint | null = null;
  constructor(init: {
    tenant: EntityOrRef<Tenant>;
    cluster: string,
    userDefaultQuota: bigint,
    accountDefaultQuota?: bigint | null,
    path: string,
    storageId: string,
  }) {
    this.tenant = toRef(init.tenant);
    this.cluster = init.cluster;
    this.path = init.path;
    this.storageId = init.storageId;
    this.userDefaultQuota = init.userDefaultQuota;
    this.accountDefaultQuota = init.accountDefaultQuota ?? null;
  }
}
