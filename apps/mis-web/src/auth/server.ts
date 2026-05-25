import type { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import type { Check } from "src/auth/requireAuth";
import { getUserInfoByUserId, validateToken } from "src/auth/token";
import type { UserInfo } from "src/models/User";
import { runtimeConfig } from "src/utils/config";

import { getTokenFromCookie } from "src/auth/cookie";

type RequestType = NextApiRequest | NextPageContext["req"];

export type AuthResultError = 401 | 403;

const X_SCOW_API_AUTH_TOKEN = "x-scow-api-auth-token";
const X_SCOW_USER_ID = "x-scow-user-id";

function getHeaderValue(req: RequestType, key: string): string | undefined {
  const raw = req?.headers?.[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

export async function checkCookie(check: Check, req: RequestType): Promise<AuthResultError | UserInfo> {

  const headerToken = getHeaderValue(req, X_SCOW_API_AUTH_TOKEN);

  // Static secret authentication via x-scow-api-auth-token header
  if (headerToken && runtimeConfig.SCOW_API_AUTH_TOKEN && headerToken === runtimeConfig.SCOW_API_AUTH_TOKEN) {
    const userId = getHeaderValue(req, X_SCOW_USER_ID);
    if (!userId) {
      return 401;
    }

    const userInfo = await getUserInfoByUserId(userId);
    if (!userInfo) {
      return 401;
    }

    if (!check(userInfo)) {
      return 403;
    }

    return userInfo;
  }

  // Use x-scow-api-auth-token header as SCOW token, or fall back to cookie
  const token = headerToken ?? getTokenFromCookie({ req });

  if (!token) {
    return 401;
  }

  const result = await validateToken(token);

  if (!result) {
    return 401;
  }

  if (!check(result)) {
    return 403;
  }

  return result;
}

export type SSRProps<T, TExtraErrorCode = never> =
  | {
      error: AuthResultError | TExtraErrorCode;
    }
  | T;

export const ssrAuthenticate = (check: Check) => async (req: NextPageContext["req"]) => {
  // return await checkCookie(check, req);
  const result = await checkCookie(check, req);
  return result;
};

export const authenticate =
  (check: Check) =>
  async (req: NextApiRequest, res: NextApiResponse): Promise<undefined | UserInfo> => {
    const result = await checkCookie(check, req);

    if (typeof result === "number") {
      res.status(result).send(undefined);
      return undefined;
    } else {
      return result;
    }
  };
