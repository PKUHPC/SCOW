import { router } from "src/server/trpc/def";
import { backendApiProcedure, callBackendApi } from "src/server/trpc/route/backend/common";
import { z } from "zod";

const PairsSchema = z.record(z.number().int().gte(0), z.number().int().gte(0)).optional();

export const TranspileInputSchema = z.object({
  source: z.string(),
  lang: z.string(),
  courier: z.string().optional(),
  pairs: PairsSchema,
  accountName: z.string(),
});

export const TranspileOutputSchema = z.object({
  source: z.string(),
  lang: z.string(),
  courier: z.string().optional(),
  pairs: PairsSchema,
});

export const transpile = router({
  transpile: backendApiProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/tc/{accountName}/transpile",
      },
    })
    .input(TranspileInputSchema)
    .output(TranspileOutputSchema)
    .mutation(async ({ input }) => {
      const resp = await callBackendApi("/transpile", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return resp as any;
    }),
});
