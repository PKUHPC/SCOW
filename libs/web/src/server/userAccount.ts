import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AccountState, GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { getClientFn } from "src/utils/api";

export const libWebGetUserInfo = async (
  userId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<GetUserInfoResponse | undefined> => {
  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };
  const getMisClient = getClientFn(config);
  const client = getMisClient(UserServiceClient);

  try {
    const reply = await asyncClientCall(client, "getUserInfo", { userId });

    // 返回用户信息的时候，去掉已删除的账户
    return {
      ...reply,
      affiliations: reply.affiliations.filter((account) => account.accountState !== AccountState.ACCOUNT_DELETED),
    };
  } catch (e: any) {
    console.error(e.details);
    return undefined;
  }
};
