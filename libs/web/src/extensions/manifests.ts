/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { callExtensionRoute, defineExtensionRoute } from "src/extensions/routes";
import { z } from "zod";

export const CommonExtensionManifestsSchema = z.object({
  rewriteNavigations: z.boolean().default(false),

  navbarLinks: z.union([
    z.boolean(),
    z.object({
      enabled: z.boolean().default(false),
      autoRefresh: z.optional(z.object({
        enabled: z.boolean().default(false),
        intervalMs: z.number(),
      })),
    }),
  ]).default(false),

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
