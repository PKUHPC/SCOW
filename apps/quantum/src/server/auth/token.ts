import { getUser, validateToken as authValidateToken } from "@scow/lib-auth";
import { UserInfo } from "src/models/User";
import { config } from "src/server/config/env";
import { USE_MOCK } from "src/utils/processEnv";

import { mockUserInfo } from "./server";

const AUTH_INTERNAL_URL = config.AUTH_INTERNAL_URL;


export async function validateToken(token: string | undefined): Promise<UserInfo | undefined> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return mockUserInfo;
  }

  if (!token) { return undefined; }

  const resp = await authValidateToken(AUTH_INTERNAL_URL, token).catch(() => undefined);

  if (!resp) {
    return undefined;
  }

  const userInfo = await getUser(AUTH_INTERNAL_URL, { identityId: resp.identityId })
    .catch(() => undefined);

  return {
    identityId: resp.identityId,
    name: userInfo?.name,
  };

}

