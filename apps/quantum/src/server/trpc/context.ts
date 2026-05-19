import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import type { NextApiRequest, NextApiResponse } from "next";

import { ClientUserInfo } from "src/server/trpc/route/auth";

export type Context = object;

export type SSRContext<R = any> = Context & {
  req: NextApiRequest;
  res: NextApiResponse<R>;
  user?: ClientUserInfo;
  [key: string]: unknown;
};

export type GlobalContext = SSRContext;

export function isSSRContext(ctx: GlobalContext): ctx is SSRContext {
  return !!((ctx as SSRContext)?.req && (ctx as SSRContext)?.res);
}

export const createContext = (ctx: CreateNextContextOptions): GlobalContext => ctx;
