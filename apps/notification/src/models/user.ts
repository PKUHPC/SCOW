import { Static, Type } from "@sinclair/typebox";
import { ValueOf } from "next/dist/shared/lib/constants";

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

export enum UserRole {
  USER = 0,
  ADMIN = 1,
  OWNER = 2,
}

export const PlatformRoleTexts = {
  [PlatformRole.PLATFORM_FINANCE]: "平台财务人员",
  [PlatformRole.PLATFORM_ADMIN]: "平台管理员",
};

export const TenantRoleTexts = {
  [TenantRole.TENANT_FINANCE]: "财务人员",
  [TenantRole.TENANT_ADMIN]: "租户管理员",
};

export const UserRoleTexts = {
  [UserRole.USER]: "用户",
  [UserRole.OWNER]: "主管理员",
  [UserRole.ADMIN]: "管理员",
};

export const AccountAffiliationSchema = Type.Object({
  accountName: Type.String(),
  role: Type.Enum(UserRole),
});

export type AccountAffiliation = Static<typeof AccountAffiliationSchema>;

export const UserInfoSchema = Type.Object({
  tenant: Type.String(),
  name: Type.Optional(Type.String()),
  identityId: Type.String(),
  accountAffiliations: Type.Array(AccountAffiliationSchema),
  tenantRoles: Type.Array(Type.Enum(TenantRole)),
  platformRoles: Type.Array(Type.Enum(PlatformRole)),
  email: Type.Optional(Type.String()),
  createTime: Type.Optional(Type.String()),
});

export type UserInfo = Static<typeof UserInfoSchema>;
