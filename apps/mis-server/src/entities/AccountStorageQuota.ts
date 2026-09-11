import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from "@mikro-orm/core";
import { Account } from "src/entities/Account";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
@Unique({ properties: ["account", "storageId"] })
export class AccountStorageQuota {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Account, { deleteRule: "cascade", ref: true, nullable: false })
  account: Ref<Account>;

  @Index({ name: "idx_storage_id" })
  @Property({ nullable: false, comment: "文件系统 storageId" })
  storageId: string;

  // 存储为 MB，null 表示使用默认值
  @Property({ columnType: "bigint", nullable: true, comment: "账户存储配额，单位 MB，null 表示使用默认值" })
  storageQuotaMb: bigint | null;

  // 定时获取，会有延迟，单位为 MB
  @Property({ columnType: "bigint", comment: "租户下账户的存储使用量（MB）" })
  usage: bigint;

  constructor(init: {
    account: EntityOrRef<Account>;
    storageId: string;
    storageQuotaMb?: bigint | null;
    usage?: bigint;
  }) {
    this.account = toRef(init.account);
    this.storageId = init.storageId;
    this.storageQuotaMb = init.storageQuotaMb ?? null;
    this.usage = init.usage ?? BigInt(0);
  }
}
