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

import { HandlerContext } from "@connectrpc/connect";
import { getCookieValue } from "src/utils/cookie";
export const SCOW_COOKIE_KEY = "SCOW_USER";

export function getUserToken(ctx: HandlerContext): string | null {

  const cookie = ctx.requestHeader.get("cookie");
  if (cookie) {
    return getCookieValue(cookie, SCOW_COOKIE_KEY);
  }

  return null;
}
