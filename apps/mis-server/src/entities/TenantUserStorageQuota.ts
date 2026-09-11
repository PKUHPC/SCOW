import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from "@mikro-orm/core";
import { User } from "src/entities/User";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
@Unique({ properties: ["user", "storageId"] })
export class TenantUserStorageQuota {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => User, { deleteRule: "cascade", ref: true, nullable: false })
  user: Ref<User>;

  // 兼容字段：记录最近一次落到文件系统执行时使用的 cluster，
  // 不再作为用户配额的业务主键。
  @Index({ name: "idx_cluster" })
  @Property({ nullable: false })
  cluster: string;

  // 兼容字段：记录最近一次落到文件系统执行时使用的 mountPath，
  // 不再作为用户配额的业务主键。
  @Index({ name: "idx_path" })
  @Property({ nullable: false, comment: "存储挂载目录" })
  path: string;

  @Index({ name: "idx_storage_id" })
  @Property({ nullable: false, comment: "文件系统 storageId" })
  storageId: string;

  // 存储为 MB
  @Property({ nullable: true, columnType: "bigint", comment: "租户下用户的存储配额（MB）" })
  storageQuota?: bigint;

  // 定时获取，会有延迟，单位为 MB
  @Property({ columnType: "bigint", comment: "租户下用户的存储使用量（MB）" })
  usage: bigint;

  constructor(init: {
    user: EntityOrRef<User>;
    cluster: string,
    path: string,
    storageId: string,
    storageQuota?: bigint,
    usage: bigint,
  }) {
    this.user = toRef(init.user);
    this.cluster = init.cluster;
    this.path = init.path;
    this.storageId = init.storageId;
    this.storageQuota = init.storageQuota;
    this.usage = init.usage;
  }
}
