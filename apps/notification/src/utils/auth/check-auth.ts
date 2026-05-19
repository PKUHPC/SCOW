import { Code, ConnectError, HandlerContext } from "@connectrpc/connect";
import { UserInfo } from "src/models/user";
import { getUserToken } from "src/server/auth/cookie";
import { validateToken } from "src/server/auth/token";

export async function checkAuth(context: HandlerContext): Promise<UserInfo> {
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
