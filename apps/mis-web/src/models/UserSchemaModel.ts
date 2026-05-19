import { Static, Type } from "@sinclair/typebox";
import { MetadataMap } from "src/pages/api/finance/charges";

import {
  AccountState,
  ClusterAccountInfo_ImportStatus,
  DisplayedAccountState,
  DisplayedUserState,
  PlatformRole,
  TenantRole,
  UserRole,
  UserState,
  UserStateInAccount,
  UserStatus,
} from "./User";

// 这个Model重新用typebox定义了
// 定义Schema时无法复用的@scow/protos/build/server中的interface
export const Money = Type.Object({
  positive: Type.Boolean(),
  yuan: Type.Number(),
  /** 4 decimal places */
  decimalPlace: Type.Number(),
});
export type Money = Static<typeof Money>;

export const PlatformTenantsInfo = Type.Object({
  tenantId: Type.Number(),
  tenantName: Type.String(),
  userCount: Type.Number(),
  accountCount: Type.Number(),
  balance: Type.Optional(Money),
  createTime: Type.Optional(Type.String()),
});
export type PlatformTenantsInfo = Static<typeof PlatformTenantsInfo>;

export const PlatformUserInfo = Type.Object({
  userId: Type.String(),
  name: Type.String(),
  email: Type.String(),
  phone: Type.Optional(Type.String()),
  organization: Type.Optional(Type.String()),
  adminComment: Type.Optional(Type.String()),
  metadata: Type.Optional(MetadataMap),
  availableAccounts: Type.Array(Type.String()),
  tenantName: Type.String(),
  createTime: Type.Optional(Type.String()),
  platformRoles: Type.Array(Type.Enum(PlatformRole)),
  state: Type.Enum(UserState),
});
export type PlatformUserInfo = Static<typeof PlatformUserInfo>;

export const UserInAccount = Type.Object({
  userId: Type.String(),
  userName: Type.String(),
  blocked: Type.Boolean(),
});
export type UserInAccount = Static<typeof UserInAccount>;

export const ClusterAccountInfo = Type.Object({
  accountName: Type.String(),
  users: Type.Array(UserInAccount),
  owner: Type.Optional(Type.String()),
  importStatus: Type.Enum(ClusterAccountInfo_ImportStatus),
  blocked: Type.Boolean(),
});
export type ClusterAccountInfo = Static<typeof ClusterAccountInfo>;

export const ImportUsersData_AccountInfo = Type.Object({
  accountName: Type.String(),
  users: Type.Array(UserInAccount),
  /** owner is undefined while account has existed */
  // owner: Type.Optional(Type.Union([Type.String(), Type.Undefined()])),
  owner: Type.Optional(Type.String()),
  blocked: Type.Boolean(),
});
export type ImportUsersData_AccountInfo = Static<typeof ImportUsersData_AccountInfo>;

export const ImportUsersData = Type.Object({
  accounts: Type.Array(ImportUsersData_AccountInfo),
});
export type ImportUsersData = Static<typeof ImportUsersData>;

export const AccountStatus = Type.Object({
  userStatus: Type.Enum(UserStatus),
  accountBlocked: Type.Boolean(),
  jobChargeLimit: Type.Optional(Money),
  usedJobCharge: Type.Optional(Money),
  balance: Type.Optional(Money),
  isInWhitelist: Type.Optional(Type.Boolean()),
  blockThresholdAmount: Type.Optional(Money),
  accountState: Type.Enum(AccountState),
});
export type AccountStatus = Static<typeof AccountStatus>;

export const Account = Type.Object({
  tenantName: Type.String(),
  accountName: Type.String(),
  userCount: Type.Number(),
  blocked: Type.Boolean(),
  state: Type.Optional(Type.Enum(AccountState)),
  displayedState: Type.Optional(Type.Enum(DisplayedAccountState)),
  isInWhitelist: Type.Optional(Type.Boolean()),
  ownerId: Type.String(),
  ownerName: Type.String(),
  comment: Type.String(),
  balance: Type.Optional(Money),
  blockThresholdAmount: Type.Optional(Money),
  defaultBlockThresholdAmount: Type.Optional(Money),
});
export type Account = Static<typeof Account>;

export const AccountAffiliation = Type.Object({
  accountName: Type.String(),
  role: Type.Enum(UserRole),
  accountState: Type.Enum(AccountState),
});
export type AccountAffiliation = Static<typeof AccountAffiliation>;

export const User = Type.Object({
  tenantName: Type.String(),
  userId: Type.String(),
  name: Type.String(),
  email: Type.String(),
  phone: Type.Optional(Type.String()),
  organization: Type.Optional(Type.String()),
  adminComment: Type.Optional(Type.String()),
  metadata: Type.Optional(MetadataMap),
  createTime: Type.Optional(Type.String()),
  accountAffiliations: Type.Array(AccountAffiliation),
  platformRoles: Type.Array(Type.Enum(PlatformRole)),
  tenantRoles: Type.Array(Type.Enum(TenantRole)),
  state: Type.Enum(UserState),
});
export type User = Static<typeof User>;

export const WhitelistedAccount = Type.Object({
  accountName: Type.String(),
  ownerId: Type.String(),
  ownerName: Type.String(),
  addTime: Type.Optional(Type.String()),
  operatorId: Type.String(),
  comment: Type.String(),
  balance: Type.Optional(Money),
  expirationTime: Type.Optional(Type.String({ format: "date-time" })),
});
export type WhitelistedAccount = Static<typeof WhitelistedAccount>;

export const AccountUserInfo = Type.Object({
  userId: Type.String(),
  name: Type.String(),
  email: Type.String(),
  status: Type.Enum(UserStatus),
  role: Type.Enum(UserRole),
  /** cluster and quota */
  storageQuotas: Type.Record(Type.String(), Type.Number()),
  jobChargeLimit: Type.Optional(Money),
  usedJobChargeLimit: Type.Optional(Money),
  userStateInAccount: Type.Enum(UserStateInAccount),
  displayedUserState: Type.Enum(DisplayedUserState),
});
export type AccountUserInfo = Static<typeof AccountUserInfo>;
