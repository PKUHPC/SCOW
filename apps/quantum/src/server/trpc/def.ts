import { initTRPC } from "@trpc/server";
import Superjson from "superjson";
import { OpenApiMeta } from "trpc-openapi";

import type { GlobalContext } from "./context";

export const trpc = initTRPC.context<GlobalContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: Superjson,
  });

export const { middleware, procedure, router, mergeRouters } = trpc;

