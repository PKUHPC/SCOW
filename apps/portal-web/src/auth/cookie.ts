import { destroyCookie, parseCookies, setCookie } from "nookies";

// Cookie is of format

export const TOKEN_KEY = "SCOW_USER";
const COOKIE_PATH = "/";

export type ParseCookieContext = Parameters<typeof parseCookies>[0];
type SetCookieContext = Parameters<typeof setCookie>[0];

export function getTokenFromCookie(ctx?: ParseCookieContext): string | undefined {
  return parseCookies(ctx)[TOKEN_KEY] ?? undefined;
}

function setCookieWithAge(ctx: SetCookieContext, key: string, value: string) {
  setCookie(ctx, key, value, {
    path: COOKIE_PATH,
  });
}

export function setTokenCookie(ctx: SetCookieContext, token: string) {
  setCookieWithAge(ctx, TOKEN_KEY, token);
}

export function destroyUserInfoCookie(ctx: SetCookieContext) {
  destroyCookie(ctx, TOKEN_KEY, { path: COOKIE_PATH });
}
