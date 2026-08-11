import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from "@mikro-orm/core";
import { Cluster } from "src/entities/Cluster";
import { User } from "src/entities/User";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";

import { Account } from "./Account";
import { AppScope } from "./AppScope";

@Entity()
@Unique({
  name: "uk_cluster_account_scope_app",
  // 查询通常同时限定集群、账户、scope 和 appId；四列均为等值条件。
  properties: ["cluster", "account", "appScope", "appId"],
})
@Index({
  name: "idx_cluster_scope_app",
  // 支持按集群、scope 和应用查询全部禁用账户，避免被唯一索引中的 account 列阻断最左匹配。
  properties: ["cluster", "appScope", "appId"],
})
export class AccountAppBlacklist {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Account, { deleteRule: "cascade", ref: true, nullable: false })
  account: Ref<Account>;

  @Property({ columnType: "varchar(255)", nullable: false })
  appId: string;

  @Enum({ items: () => AppScope, comment: Object.values(AppScope).join(", ") })
  appScope: AppScope;

  @ManyToOne(() => Cluster, { deleteRule: "cascade", ref: true, nullable: false })
  cluster: Ref<Cluster>;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  disabledAt: Date;

  @ManyToOne(() => User, { deleteRule: "set null", ref: true, nullable: true })
  operator?: Ref<User>;

  constructor(init: {
    account: EntityOrRef<Account>;
    appId: string;
    appScope: AppScope;
    cluster: EntityOrRef<Cluster>;
    operator?: EntityOrRef<User>;
    disabledAt?: Date;
  }) {
    this.account = toRef(init.account);
    this.appId = init.appId;
    this.appScope = init.appScope;
    this.cluster = toRef(init.cluster);
    if (init.operator) {
      this.operator = toRef(init.operator);
    }
    this.disabledAt = init.disabledAt ?? new Date();
  }
}
