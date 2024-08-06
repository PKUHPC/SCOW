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

import { Collection, Entity, Enum, ManyToOne, OneToMany, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { StorageQuota } from "src/entities/StorageQuota";
import { Tenant } from "src/entities/Tenant";
import { UserAccount } from "src/entities/UserAccount";
import { CURRENT_TIMESTAMP, DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";

export enum PlatformRole {
  PLATFORM_FINANCE = "PLATFORM_FINANCE",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
}

export enum TenantRole {
  TENANT_FINANCE = "TENANT_FINANCE",
  TENANT_ADMIN = "TENANT_ADMIN",
}

export enum UserState {
  NORMAL = "NORMAL",
  DELETED = "DELETED",
}

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => Tenant, { ref: true })
  tenant: Ref<Tenant>;

  @Property({ unique: true })
  userId: string;

  @OneToMany(() => StorageQuota, (u) => u.user)
  storageQuotas = new Collection<StorageQuota>(this);

  @Property()
  name: string;

  @Property()
  email: string;

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  createTime: Date;

  @OneToMany(() => UserAccount, (u) => u.user)
  accounts = new Collection<UserAccount>(this);

  @Enum({ items: () => TenantRole, array: true, comment: Object.values(TenantRole).join(", ") })
  tenantRoles: TenantRole[];

  @Enum({ items: () => PlatformRole, array: true, comment: Object.values(PlatformRole).join(", ") })
  platformRoles: PlatformRole[];

  @Enum({ items: () => UserState, default: UserState.NORMAL, comment: Object.values(UserState).join(", ") })
  state: UserState = UserState.NORMAL;

  @Property({ nullable: true })
  deleteRemark?: string;

  constructor(init: {
    userId: string;
    tenant: EntityOrRef<Tenant>;
    name: string;
    email: string;
    createTime?: Date;
    tenantRoles?: TenantRole[];
    platformRoles?: PlatformRole[];
    state?: UserState;
    deleteRemark?: string;
  }) {
    this.userId = init.userId;
    this.tenant = toRef(init.tenant);
    this.name = init.name;
    this.email = init.email;
    this.createTime = init.createTime ?? new Date();
    this.tenantRoles = init.tenantRoles ?? [];
    this.platformRoles = init.platformRoles ?? [];
    this.state = init.state ?? UserState.NORMAL;
    this.deleteRemark = init.deleteRemark ?? "";
  }

}
