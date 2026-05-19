import { NextApiResponse } from "next";
import { destroyCookie, parseCookies, setCookie } from "nookies";
import { RequestType } from "src/utils/type";

export const SCOW_COOKIE_KEY = "SCOW_USER";

const COOKIE_PATH = "/";

export function deleteUserToken(res?: NextApiResponse) {
  destroyCookie(res ? { res } : {}, SCOW_COOKIE_KEY, {
    path: COOKIE_PATH,
  });
}

export function getUserToken(req: RequestType): string | undefined {
  if (req instanceof Request) {
    return req.cookies.get(SCOW_COOKIE_KEY)?.value;
  }

  const cookies = parseCookies({ req });

  return cookies[SCOW_COOKIE_KEY];
}

export function setUserTokenCookie(token: string, res: NextApiResponse) {
  setCookie({ res }, SCOW_COOKIE_KEY, token, {
    path: COOKIE_PATH,
  });
}
