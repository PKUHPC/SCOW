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

export interface UserInfo {
  identityId: string;
  name?: string;
  phone?: string;
  email?: string;
  tenantName?: string;
  organization?: string;
  tenantRoles?: TenantRole[];
  platformRoles?: PlatformRole[];
  createTime?: string;
}
