import { getClusterConfigs, getSortedClusterIds } from "@scow/config/build/cluster";
import { DEFAULT_PRIMARY_COLOR } from "@scow/config/build/ui";
import { join } from "path";
import { config as envConfig } from "src/server/config/env";
import { uiConfig } from "src/server/config/ui";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { router } from "../def";
import { baseProcedure } from "../procedure/base";

const UiConfigSchema = z.object({
  config: z.object({
    footer: z
      .object({
        defaultText: z.string().optional(),
        hostnameMap: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
    primaryColor: z
      .object({
        defaultColor: z.string().default(DEFAULT_PRIMARY_COLOR),
        hostnameMap: z.record(z.string(), z.string()).optional(),
        darkModeColor: z.string().optional(),
      })
      .optional(),
  }),
  defaultPrimaryColor: z.string().default(DEFAULT_PRIMARY_COLOR),
});
export type UiConfig = z.infer<typeof UiConfigSchema>;

const configPath = USE_MOCK ? join(__dirname, "config") : undefined;
const clustersInit = getClusterConfigs(configPath, console);
// 配置文件中的已配置集群
export const clusters = clustersInit;

const PublicConfigSchema = z.object({
  BASE_PATH: z.string(),
  CLUSTER_SORTED_ID_LIST: z.array(z.string()),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

export const config = router({
  getUiConfig: baseProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/config/ui",
        tags: ["config"],
        summary: "uiConfig",
      },
    })
    .input(z.void())
    .output(UiConfigSchema)
    .query(() => {
      return {
        config: uiConfig,
        defaultPrimaryColor: DEFAULT_PRIMARY_COLOR,
      };
    }),

  publicConfig: baseProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/config",
        tags: ["config"],
        summary: "config",
      },
    })
    .input(z.void())
    .output(PublicConfigSchema)
    .query(async () => {
      return {
        BASE_PATH: envConfig.NEXT_PUBLIC_RUNTIME_BASE_PATH,
        CLUSTER_SORTED_ID_LIST: getSortedClusterIds(clusters),
      };
    }),
});
