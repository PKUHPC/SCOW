import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from "@mikro-orm/core";
import { User } from "src/entities/User";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
@Unique({ properties: ["cluster", "user", "path"] })
export class TenantUserStorageQuota {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => User, { deleteRule: "cascade", ref: true, nullable: false })
  user: Ref<User>;

  @Index({ name: "idx_cluster" })
  @Property({ nullable: false })
  cluster: string;

  @Index({ name: "idx_path" })
  @Property({ nullable: false, comment: "存储挂载目录" })
  path: string;

  // 存储为 bytes
  @Property({ nullable: true, columnType: "bigint", comment: "租户下用户的存储配额" })
  storageQuota?: bigint;

  // 定时获取，会有延迟，单位为 bytes
  @Property({ columnType: "bigint", comment: "租户下用户的存储使用量" })
  usage: bigint;

  constructor(init: {
    user: EntityOrRef<User>;
    cluster: string,
    path: string,
    storageQuota?: bigint,
    usage: bigint,
  }) {
    this.user = toRef(init.user);
    this.cluster = init.cluster;
    this.path = init.path;
    this.storageQuota = init.storageQuota;
    this.usage = init.usage;
  }

}
