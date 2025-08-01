import { IncomingMessage } from "http";
import { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import { NextRequest } from "next/server";
import { deleteUserToken, getUserToken } from "src/server/auth/cookie";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { USE_MOCK } from "src/utils/processEnv";

import { validateToken } from "./token";

export const mockUserInfo: ClientUserInfo = {
  identityId: "demo_admin",
  name:"mock-user",
  token: "demo_admin",
};

type RequestType = IncomingMessage | NextApiRequest | NextRequest | NextPageContext["req"];

export async function getUserInfo(req: RequestType, res?: NextApiResponse): Promise<ClientUserInfo | undefined> {

  const token = getUserToken(req);
  if (!token) { return undefined; }

  if (USE_MOCK) {
    return mockUserInfo;
  }

  const result = await validateToken(token);


  if (!result?.identityId) {
    deleteUserToken(res);
    return;
  }

  return { ...result, token };

}

