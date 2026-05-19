import { router } from "src/server/trpc/def";
import { backendApiProcedure, callBackendApi } from "src/server/trpc/route/backend/common";
import { z } from "zod";

export const MyQitsOutputSchema = z.object({
  uuid: z.string(),
  qits: z.object({
    used: z.number(),
    balance: z.number(),
    paid: z.number(),
  }),
});

export const my = router({
  myQits: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/my/qits",
      },
    })
    .input(
      z.object({
        accountName: z.string(),
      }),
    )
    .output(MyQitsOutputSchema)
    .query(async () => {
      const resp = await callBackendApi("/my/qits", {
        method: "POST",
        body: JSON.stringify({}),
      });

      return resp as any;
    }),
});
