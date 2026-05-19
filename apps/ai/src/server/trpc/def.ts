import { initTRPC } from "@trpc/server";
import Superjson from "superjson";
import { OpenApiMeta } from "trpc-to-openapi";

import type { GlobalContext } from "./context";

import { DetailedTRPCError } from "../utils/detailedError";

export const trpc = initTRPC
  .context<GlobalContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: Superjson,
    errorFormatter({ error, shape }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          detailedError: error instanceof DetailedTRPCError ? error.detail : null,
        },
      };
    },
  });

export const { middleware, procedure, router, mergeRouters } = trpc;
