import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { User } from "src/entities/User";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
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
  @Property({ columnType: "bigint", comment: "租户下用户的存储配额" })
  storageQuota: bigint;

  constructor(init: {
    user: EntityOrRef<User>;
    cluster: string,
    path: string,
    storageQuota: bigint,
  }) {
    this.user = toRef(init.user);
    this.cluster = init.cluster;
    this.path = init.path;
    this.storageQuota = init.storageQuota;
  }

}
