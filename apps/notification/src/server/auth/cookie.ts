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
