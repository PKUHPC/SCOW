import { router } from "src/server/trpc/def";
import { backendApiProcedure, callBackendApi } from "src/server/trpc/route/backend/common";
import { z } from "zod";

export const app = router({
  vokeToken: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/app/voke",
      },
    })
    .input(
      z.object({
        accountName: z.string(),
      }),
    )
    .output(
      z.object({
        token: z.string(),
      }),
    )
    .mutation(async () => {
      const resp = await callBackendApi("/app/voke", {
        method: "POST",
        body: JSON.stringify({}),
      });

      return resp as any;
    }),

  revokeToken: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/app/revoke",
      },
    })
    .input(
      z.object({
        accountName: z.string(),
      }),
    )
    .output(
      z.object({
        token: z.string(),
      }),
    )
    .mutation(async () => {
      const resp = await callBackendApi("/app/revoke", {
        method: "POST",
        body: JSON.stringify({}),
      });

      return resp as any;
    }),
});
