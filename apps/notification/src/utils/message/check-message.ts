import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AccountServiceClient, GetAccountsResponse } from "@scow/protos/build/server/account";
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { NoticeType } from "src/models/notice-type";
import { type AccountAffiliation, PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/user";
import { notificationConfig } from "src/server/config/notification";
import { TargetType } from "src/server/entities/UserMessageRead";
import { getScowClient } from "src/utils/scow-client";

export const isUserAccountsAdmin = (
  senderAccounts: AccountAffiliation[],
  targetAccounts: AccountAffiliation[],
): boolean => {
  for (const targetAccount of targetAccounts) {
    if (!senderAccounts.some((x) => x.accountName === targetAccount.accountName && x.role !== UserRole.USER)) {
      return false;
    }
  }
  return true;
};

export async function canSendMsg(
  userInfo: UserInfo,
  targetType: TargetType,
  targetIds: string[] | undefined,
): Promise<boolean> {
  if (userInfo.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
    return true;
  }
  // targetIds 为 undefined，只能是发送全站消息，但又不是平台管理员，则直接返回 false
  if (targetIds === undefined || targetIds.length === 0) {
    return false;
  }

  switch (targetType) {
    case TargetType.TENANT:
      return handleTenantTarget(userInfo, targetIds);
    case TargetType.ACCOUNT:
      return await handleAccountTarget(userInfo, targetIds);
    case TargetType.USER:
      return await handleUserTarget(userInfo, targetIds);
    default:
      return false;
  }
}

async function handleTenantTarget(userInfo: UserInfo, targetIds: string[]): Promise<boolean> {
  const tenantAdmin = userInfo.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  return tenantAdmin && targetIds[0] === userInfo.tenant;
}

async function handleAccountTarget(userInfo: UserInfo, targetIds: string[]): Promise<boolean> {
  const client = getScowClient(AccountServiceClient);
  const tenantAccounts: GetAccountsResponse = userInfo.tenantRoles.includes(TenantRole.TENANT_ADMIN)
    ? await asyncClientCall(client, "getAccounts", { tenantName: userInfo.tenant })
    : { results: [] };

  for (const accountId of targetIds) {
    const isUserAccountAdmin = userInfo.accountAffiliations.some(
      (x) => x.accountName === accountId && x.role !== UserRole.USER,
    );

    const isTenantAccount = tenantAccounts.results.some((a) => a.accountName === accountId);
    if (!isUserAccountAdmin || !isTenantAccount) {
      return false;
    }
  }
  return true;
}

async function handleUserTarget(userInfo: UserInfo, targetIds: string[]): Promise<boolean> {
  const client = getScowClient(UserServiceClient);
  const requests = targetIds.map((userId) => asyncClientCall(client, "getUserInfo", { userId }));
  const responses: GetUserInfoResponse[] = await Promise.all(requests);

  for (const info of responses) {
    const isTenantAdmin = userInfo.tenantRoles.includes(TenantRole.TENANT_ADMIN) && info.tenantName === userInfo.tenant;
    const isUserAccountAdmin = isUserAccountsAdmin(userInfo.accountAffiliations, info.affiliations);
    if (!isTenantAdmin && !isUserAccountAdmin) {
      return false;
    }
  }
  return true;
}

export const checkNoticeTypeEnabled = (noticeType: NoticeType) => {
  const noticeTypeConfig = notificationConfig.noticeType;

  switch (noticeType) {
    case NoticeType.SITE_MESSAGE:
      return noticeTypeConfig.siteMessage.enabled;
    case NoticeType.SMS:
      return noticeTypeConfig.SMS?.enabled ?? false;
    case NoticeType.EMAIL:
      return noticeTypeConfig.email?.enabled ?? false;
    case NoticeType.OFFICIAL_ACCOUNT:
      return noticeTypeConfig.officialAccount?.enabled ?? false;
    case NoticeType.WE_COM:
      return noticeTypeConfig.weCom?.enabled ?? false;
    case NoticeType.DING_TALK:
      return noticeTypeConfig.dingTalk?.enabled ?? false;
    case NoticeType.LARK:
      return noticeTypeConfig.lark?.enabled ?? false;
    default:
      return false;
  }
};

export const enabledNoticeTypes = Object.keys(NoticeType)
  .filter((key): key is keyof typeof NoticeType => {
    const value = NoticeType[key as keyof typeof NoticeType];
    return checkNoticeTypeEnabled(value);
  })
  .map((key): NoticeType => NoticeType[key]);
