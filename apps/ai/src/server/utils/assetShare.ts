import { TRPCError } from "@trpc/server";

import { aiConfig } from "../config/ai";

export const isAiUserShareEnabled = () => aiConfig.asset?.userShare?.enabled ?? false;

export const ensureAiUserShareEnabled = (isPlatformOwned?: boolean) => {
  if (isPlatformOwned) {
    return;
  }

  if (isAiUserShareEnabled()) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "AI user asset sharing is disabled",
  });
};
