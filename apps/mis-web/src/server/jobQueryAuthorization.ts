import { PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/User";

interface JobQuery {
  accountName?: string;
  tenantName?: string;
  userId?: string;
}

export interface AuthorizedJobQuery extends JobQuery {
  tenantName?: string;
}

export const getAuthorizedJobQuery = (info: UserInfo, query: JobQuery): AuthorizedJobQuery | undefined => {
  // 平台管理员可以查询任意租户、账户和用户的作业；未指定租户时保留全平台范围。
  if (info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
    return query;
  }

  // 租户管理员可以查询当前租户内的作业，忽略客户端可能指定的租户范围。
  if (info.tenantRoles.includes(TenantRole.TENANT_ADMIN)) {
    return { ...query, tenantName: info.tenant };
  }

  // 账户拥有者或管理员只能查询其所管理账户在当前租户内的作业。
  if (
    query.accountName &&
    info.accountAffiliations.some(
      (affiliation) => affiliation.accountName === query.accountName && affiliation.role !== UserRole.USER,
    )
  ) {
    return { ...query, tenantName: info.tenant };
  }

  // 普通用户只能查询自己的作业。
  if (query.userId === info.identityId) {
    return { ...query, tenantName: info.tenant };
  }

  return undefined;
};
