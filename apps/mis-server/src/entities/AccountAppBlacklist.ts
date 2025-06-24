import { Entity, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Cluster } from "src/entities/Cluster";
import { User } from "src/entities/User";
import { EntityOrRef, toRef } from "src/utils/orm";

import { Account } from "./Account";

@Entity()
export class AccountAppBlacklist {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Account, { deleteRule: "cascade", ref: true, nullable: false })
  account: Ref<Account>;

  @Property({ columnType: "varchar(255)", nullable: false })
  appId: string;

  @ManyToOne(() => Cluster, { deleteRule: "cascade", ref: true, nullable: false })
  cluster: Ref<Cluster>;

  @Property({ defaultRaw: "CURRENT_TIMESTAMP" })
  disabledAt: Date = new Date();

  @ManyToOne(() => User, { deleteRule: "set null", ref: true, nullable: true })
  operator?: Ref<User>;

  constructor(init: {
    account: EntityOrRef<Account>,
    appId: string,
    cluster: EntityOrRef<Cluster>,
    operator?: EntityOrRef<User>,
  }) {
    this.account = toRef(init.account);
    this.appId = init.appId;
    this.cluster = toRef(init.cluster);
    if (init.operator) {
      this.operator = toRef(init.operator);
    }
    this.disabledAt = new Date();
  }
}
