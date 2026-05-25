import { getUser, validateToken as authValidateToken } from "@scow/lib-auth";
import { USE_MOCK } from "src/apis/useMock";
import { UserInfo } from "src/models/User";
import { runtimeConfig } from "src/utils/config";

export async function validateToken(token: string | undefined): Promise<UserInfo | undefined> {
  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    if (!runtimeConfig.MOCK_USER_ID) {
      throw new Error("Using mock user id but runtimeConfig.MOCK_USER_ID is not set");
    }
    return { identityId: runtimeConfig.MOCK_USER_ID, name: runtimeConfig.MOCK_USER_ID };
  }

  if (!token) {
    return undefined;
  }

  const resp = await authValidateToken(runtimeConfig.AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  return await getUserInfoByUserId(resp.identityId);

}

export async function getUserInfoByUserId(userId: string): Promise<UserInfo> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return { identityId: userId, name: userId };
  }

  const userInfo = await getUser(runtimeConfig.AUTH_INTERNAL_URL, { identityId: userId })
    .catch(() => undefined);

  return {
    identityId: userId,
    name: userInfo?.name,
  };
}
