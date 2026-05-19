import type { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import type { Check } from "src/auth/requireAuth";
import type { UserInfo } from "src/models/User";

import { getTokenFromCookie } from "src/auth/cookie";
import { validateToken } from "src/auth/token";

type RequestType = NextApiRequest | NextPageContext["req"];

export type AuthResultError = 401 | 403;

export async function checkCookie(check: Check, req: RequestType): Promise<AuthResultError | UserInfo> {
  const token = getTokenFromCookie({ req });

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
