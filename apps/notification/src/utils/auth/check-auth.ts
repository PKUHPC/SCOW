import { Code, ConnectError, HandlerContext } from "@connectrpc/connect";
import { UserInfo } from "src/models/user";
import { getUserToken } from "src/server/auth/cookie";
import { validateToken } from "src/server/auth/token";
import { authUserInfoContextKey } from "src/utils/auth/auth-context";

export async function checkAuth(context: HandlerContext): Promise<UserInfo> {
  const cachedInfoPromise = context.values.get(authUserInfoContextKey);
  if (cachedInfoPromise) {
    const cachedInfo = await cachedInfoPromise;
    if (!cachedInfo) {
      throw new ConnectError("UNAUTHORIZED", Code.Unauthenticated);
    }

    return cachedInfo;
  }

  const token = getUserToken(context);

  if (!token) {
    throw new ConnectError("UNAUTHORIZED", Code.Unauthenticated);
  }

  const info = await validateToken(token);

  if (!info) {
    throw new ConnectError("UNAUTHORIZED", Code.Unauthenticated);
  }

  return info;
}
