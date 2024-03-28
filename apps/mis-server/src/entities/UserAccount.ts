/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Entity, Enum, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { Account } from "src/entities/Account";
import { User } from "src/entities/User";
import { DecimalType } from "src/utils/decimal";
import { EntityOrRef, toRef } from "src/utils/orm";

// 用户在集群中的状态
export enum UserStatus {
  UNBLOCKED = "UNBLOCKED",
  BLOCKED = "BLOCKED",
}

// 用户在账户中的状态，是否被手动封锁
export enum UserStateInAccount {
  // 未被手动封锁
  NORMAL = "NORMAL",
  // 被上级手动封锁
  BLOCKED_BY_ADMIN = "BLOCKED_BY_ADMIN",
}

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  OWNER = "OWNER",
}

@Entity()
export class UserAccount {
  @PrimaryKey()
    id!: number;

  @ManyToOne(() => User, { deleteRule: "cascade", ref: true, nullable: false })
    user: Ref<User>;

  @ManyToOne(() => Account, { deleteRule: "cascade", ref: true, nullable: false })
    account: Ref<Account>;

  @Property({ columnType: "varchar(10)", comment: Object.values(UserStatus).join(", ") })
    blockedInCluster: UserStatus;

  @Property({ columnType: "varchar(10)", comment: Object.values(UserRole).join(", ") })
    role: UserRole;

  @Property({ type: DecimalType, nullable: true })
    usedJobCharge?: Decimal;

  @Property({ type: DecimalType, nullable: true })
    jobChargeLimit?: Decimal;

  @Enum({ items: () => UserStateInAccount,
    default: UserStateInAccount.NORMAL, comment: Object.values(UserStateInAccount).join(", ") })
    state?: UserStateInAccount;

  constructor(init: {
    user: EntityOrRef<User>,
    account: EntityOrRef<Account>,
    blockedInCluster: UserStatus,
    role: UserRole,
    jobChargeLimit?: Decimal,
    usedJobCharge?: Decimal,
    state?: UserStateInAccount,
  }) {
    this.user = toRef(init.user);
    this.account = toRef(init.account);
    this.blockedInCluster = init.blockedInCluster;
    this.role = init.role;
    this.jobChargeLimit = init.jobChargeLimit;
    this.usedJobCharge = init.usedJobCharge;
    this.state = init.state || UserStateInAccount.NORMAL;
  }
}
