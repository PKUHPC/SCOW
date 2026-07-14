import { LogContext, withLogContext } from "@scow/lib-server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type pino from "pino";

import { UserInfo } from "src/models/user";
import { logger } from "src/utils/logger";

export interface Context {
  logger: pino.Logger;
  logContext: LogContext;
}

export type SSRContext<R = any> = Context & {
  req: NextApiRequest;
  res: NextApiResponse<R>;
  user?: UserInfo;
  [key: string]: unknown;
};

export type GlobalContext = SSRContext;

export function isSSRContext(ctx: GlobalContext): ctx is SSRContext {
  return !!((ctx as SSRContext)?.req && (ctx as SSRContext)?.res);
}

export const createContext = (ctx: CreateNextContextOptions): GlobalContext => {
  const logContext = {
    req: randomUUID(),
    path: ctx.req.url?.split("?")[0],
  };

  return {
    ...ctx,
    logContext,
    logger: withLogContext(logger, logContext),
  };
};
