/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { IncomingMessage } from "http";
import { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import { NextRequest } from "next/server.js";
import { destroyCookie, parseCookies, setCookie } from "nookies";
import { USE_MOCK } from "src/utils/processEnv";

export const SCOW_COOKIE_KEY = "SCOW_USER";

const COOKIE_PATH = "/";

export function deleteUserToken(res?: NextApiResponse) {
  destroyCookie(res ? { res } : {}, SCOW_COOKIE_KEY, {
    path: COOKIE_PATH,
  });
}

type RequestType = NextRequest | IncomingMessage | NextApiRequest | NextPageContext["req"];

export function getUserToken(req: RequestType): string | undefined {
  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return "test";
  }

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
