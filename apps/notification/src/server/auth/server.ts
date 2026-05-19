import { PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/user";

export const MOCK_USER_INFO = {
  tenant: "default",
  name: "demo_admin",
  identityId: "demo_admin",
  token: "demo_admin",
  tenantRoles: [TenantRole.TENANT_ADMIN],
  platformRoles: [PlatformRole.PLATFORM_ADMIN],
  accountAffiliations: [
    { accountName: "demo_admin", role: UserRole.ADMIN },
    { accountName: "hpc2001213075", role: UserRole.USER },
  ],
  createTime: "2023-08-03T03:47:23.485Z",
} as UserInfo;
