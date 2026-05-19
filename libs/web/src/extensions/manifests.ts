import { callExtensionRoute, defineExtensionRoute } from "src/extensions/routes";
import { z } from "zod";

export const CommonExtensionManifestsSchema = z.object({
  rewriteNavigations: z.boolean().default(false),

  navbarLinks: z
    .union([
      z.boolean(),
      z.object({
        enabled: z.boolean().default(false),
        autoRefresh: z.optional(
          z.object({
            enabled: z.boolean().default(false),
            intervalMs: z.number(),
          }),
        ),
      }),
    ])
    .default(false),
});

export const ExtensionManifestsSchema = z.object({
  portal: CommonExtensionManifestsSchema.optional(),
  mis: CommonExtensionManifestsSchema.optional(),
  ai: CommonExtensionManifestsSchema.optional(),
});

export type ExtensionManifestsSchema = z.infer<typeof ExtensionManifestsSchema>;

export const manifestsRoute = defineExtensionRoute({
  path: "/manifests",
  method: "GET",
  responses: {
    200: ExtensionManifestsSchema,
  },
});

export async function fetchExtensionManifests(url: string) {
  const resp = await callExtensionRoute(manifestsRoute, {}, {}, url);

  if (resp[200]) {
    return resp[200];
  } else {
    throw new Error(`Cannot fetch extension manifests. ${JSON.stringify(resp)}`);
  }
}
