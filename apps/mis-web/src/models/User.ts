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

import { Static, Type } from "@sinclair/typebox";
import { ValueOf } from "next/dist/shared/lib/constants";

import { TransType } from "./job";

// Redefine to avoid importing non client packages
export const TenantRole = {
  TENANT_ADMIN: 0,
  TENANT_FINANCE: 1,
} as const;

export type TenantRole = ValueOf<typeof TenantRole>;

export const PlatformRole = {
  PLATFORM_ADMIN: 0,
  PLATFORM_FINANCE: 1,
} as const;

export type PlatformRole = ValueOf<typeof PlatformRole>;

export const PlatformRoleTexts = {
  [PlatformRole.PLATFORM_FINANCE]: "平台财务人员",
  [PlatformRole.PLATFORM_ADMIN]: "平台管理员",
};

export const TenantRoleTexts = {
  [TenantRole.TENANT_FINANCE]: "财务人员",
  [TenantRole.TENANT_ADMIN]: "租户管理员",
};

export enum UserRole {
  USER = 0,
  ADMIN = 1,
  OWNER = 2,
}

export const UserRoleTexts = {
  [UserRole.USER]: "用户",
  [UserRole.OWNER]: "拥有者",
  [UserRole.ADMIN]: "管理员",
};

export enum UserStatus {
  UNBLOCKED = 0,
  BLOCKED = 1,
}

export const UserStateInAccount = {
  NORMAL: 0,
  BLOCKED_BY_ADMIN: 1,
} as const;
export type UserStateInAccount = ValueOf<typeof UserStateInAccount>;

export const DisplayedUserState = {
  DISPLAYED_NORMAL: 0,
  DISPLAYED_QUOTA_EXCEEDED: 1,
  DISPLAYED_BLOCKED: 2,
} as const;
export type DisplayedUserState = ValueOf<typeof DisplayedUserState>;

export enum ClusterAccountInfo_ImportStatus {
  EXISTING = 0,
  NOT_EXISTING = 1,
  HAS_NEW_USERS = 2,
}

export const AccountAffiliationSchema = Type.Object({
  accountName: Type.String(),
  role: Type.Enum(UserRole),
});


export type AccountAffiliation = Static<typeof AccountAffiliationSchema>;

export const UserState = {
  NORMAL: 0,
  DELETED: 1,
} as const;
export type UserState = ValueOf<typeof UserState>;

export const UserInfoSchema = Type.Object({
  tenant: Type.String(),
  name: Type.Optional(Type.String()),
  identityId: Type.String(),
  accountAffiliations: Type.Array(AccountAffiliationSchema),
  tenantRoles: Type.Array(Type.Enum(TenantRole)),
  platformRoles: Type.Array(Type.Enum(PlatformRole)),
  email: Type.Optional(Type.String()),
  createTime:Type.Optional(Type.String()),
});

export type UserInfo = Static<typeof UserInfoSchema>;

export const FullUserInfo = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  createTime: Type.String(),
  accountAffiliations: Type.Array(
    Type.Object({ accountName: Type.String(), role: Type.Enum(UserRole) }),
  ),
  tenantRoles: Type.Array(Type.Enum(TenantRole)),
  state:Type.Enum(UserState),
});
export type FullUserInfo = Static<typeof FullUserInfo>;

export const SortDirectionType = Type.Union([
  Type.Literal("ascend"),
  Type.Literal("descend"),
]);
export type SortDirectionType = Static<typeof SortDirectionType>;

// sort fields
// for pageComponent AllUsersTable
export const UsersSortFieldType = Type.Union([
  Type.Literal("userId"),
  Type.Literal("name"),
  Type.Literal("createTime"),
]);
export type UsersSortFieldType = Static<typeof UsersSortFieldType>;

// 查询类型，平台账户或租户
export enum SearchType {
  ACCOUNT = "ACCOUNT",
  TENANT = "TENANT",
}

export const AccountState = {
  NORMAL: 0,
  FROZEN: 1,
  BLOCKED_BY_ADMIN: 2,
  DELETED: 3,
} as const;

export type AccountState = ValueOf<typeof AccountState>;

export const DisplayedAccountState = {
  DISPLAYED_NORMAL: 0,
  DISPLAYED_FROZEN: 1,
  DISPLAYED_BLOCKED: 2,
  DISPLAYED_BELOW_BLOCK_THRESHOLD: 3,
  DISPLAYED_DELETED: 4,
} as const;

export type DisplayedAccountState = ValueOf<typeof DisplayedAccountState>;


export const getDisplayedStateI18nTexts = (t: TransType) => {
  return {
    [DisplayedAccountState.DISPLAYED_NORMAL]: t("pageComp.accounts.accountTable.normal"),
    [DisplayedAccountState.DISPLAYED_FROZEN]: t("pageComp.accounts.accountTable.frozen"),
    [DisplayedAccountState.DISPLAYED_BLOCKED]: t("pageComp.accounts.accountTable.blocked"),
    [DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD]: t("pageComp.accounts.accountTable.debt"),
    [DisplayedAccountState.DISPLAYED_DELETED]: t("pageComp.accounts.accountTable.deleted"),
  };
};

export const ChargesSortBy = Type.Union([
  Type.Literal("userId"),
  Type.Literal("time"),
  Type.Literal("amount"),
  Type.Literal("type"),
]);

export type ChargesSortBy = Static<typeof ChargesSortBy>;

export const ChargesSortOrder = Type.Union([
  Type.Literal("descend"),
  Type.Literal("ascend"),
]);

export type ChargesSortOrder = Static<typeof ChargesSortOrder>;

export enum DeleteFailedReason {
  ACCOUNTS_OWNER = "ACCOUNTS_OWNER",
  RUNNING_JOBS = "RUNNING_JOBS",
}

export enum EntityType {
  USER = "USER",
  ACCOUNT = "ACCOUNT",
}
