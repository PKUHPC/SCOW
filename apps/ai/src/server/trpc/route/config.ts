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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { getClusterConfigs, getLoginNode, getSortedClusterIds, getSortedClusters } from "@scow/config/build/cluster";
import { getCommonConfig, getSystemLanguageConfig } from "@scow/config/build/common";
import { DEFAULT_PRIMARY_COLOR } from "@scow/config/build/ui";
import { getCapabilities } from "@scow/lib-auth";
import { parseKeyValue } from "@scow/lib-config";
import { readVersionFile } from "@scow/utils/build/version";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { aiConfig } from "src/server/config/ai";
import { commonConfig } from "src/server/config/common";
import { config as envConfig } from "src/server/config/env";
import { uiConfig } from "src/server/config/ui";
import { router } from "src/server/trpc/def";
import { authProcedure, baseProcedure } from "src/server/trpc/procedure/base";
import { getAdapterClient } from "src/server/utils/clusters";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";


const configPath = USE_MOCK ? join(__dirname, "config") : undefined;
const clustersInit = getClusterConfigs(configPath, console, ["ai"]);
Object.keys(clustersInit).map((id) => clustersInit[id].loginNodes = clustersInit[id].loginNodes.map(getLoginNode));

export const clusters = clustersInit;

const I18nStringTypeSchema = z.union([
  z.string(),
  z.object({
    i18n: z.object({
      default: z.string(),
      en: z.string().optional(),
      zh_cn: z.string().optional(),
    }),
  }),
]);

const SystemLanguageConfigSchema = z.object({
  defaultLanguage: z.string(),
  isUsingI18n: z.boolean(),
  autoDetectWhenUserNotSet: z.boolean().optional(),
});

const ClusterSchema = z.object({
  id: z.string(),
  name: I18nStringTypeSchema,
});

const NavLinkSchema: z.ZodSchema<any> = z.lazy(() => z.object({
  text: z.string(),
  url: z.string().optional(),
  openInNewPage: z.boolean().optional(),
  iconPath: z.string().optional(),
  children: z.array(
    z.object({
      text: z.string(),
      openInNewPage: z.boolean().optional(),
      iconPath: z.string().optional(),
      url: z.string(),
    }),
  ).optional(),
}));

const UserLinkSchema = z.object({
  text: z.string(),
  url: z.string(),
  openInNewPage: z.boolean().optional(),
});

const PublicConfigSchema = z.object({
  ENABLE_CHANGE_PASSWORD: z.boolean().optional(),
  MIS_URL: z.string().optional(),
  PORTAL_URL: z.string().optional(),
  CLUSTERS: z.array(ClusterSchema),
  CLUSTER_SORTED_ID_LIST: z.array(z.string()),
  PASSWORD_PATTERN: z.string().optional(),
  BASE_PATH: z.string(),
  CLIENT_MAX_BODY_SIZE: z.string(),
  FILE_EDIT_SIZE: z.string().optional(),
  FILE_PREVIEW_SIZE: z.string().optional(),
  PUBLIC_PATH: z.string(),
  NAV_LINKS: z.array(NavLinkSchema).optional(),
  USER_LINKS: z.array(UserLinkSchema).optional(),
  VERSION_TAG: z.string().optional(),
  RUNTIME_I18N_CONFIG_TEXTS: z.object({
    passwordPatternMessage: I18nStringTypeSchema.optional(),
  }),
  SYSTEM_LANGUAGE_CONFIG: SystemLanguageConfigSchema,
  LOGIN_NODES: z.record(z.string()),
  NOVNC_CLIENT_URL: z.string(),
});

const UiConfigSchema = z.object({
  config: z.object({
    footer: z.object({
      defaultText: z.string().optional(),
      hostnameMap: z.record(z.string(), z.string()).optional(),
    }).optional(),
    primaryColor: z.object({
      defaultColor: z.string().default(DEFAULT_PRIMARY_COLOR),
      hostnameMap: z.record(z.string(), z.string()).optional(),
    }).optional(),
  }),
  defaultPrimaryColor: z.string().default(DEFAULT_PRIMARY_COLOR),

});

// 类型别名
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

export type Cluster = z.infer<typeof ClusterSchema>;

export type NavLink = z.infer<typeof NavLinkSchema>;

export type UiConfig = z.infer<typeof UiConfigSchema>;


const PartitionSchema = z.object({
  name: z.string(),
  memMb: z.number(),
  cores: z.number(),
  gpus: z.number(),
  nodes: z.number(),
  qos: z.array(z.string()),
  comment: z.string().optional(),
  gpuType: z.string().optional(),
  vramMb: z.number().optional(),
});

export const ClusterConfigSchema = z.object({
  schedulerName: z.string(),
  partitions: z.array(PartitionSchema),
});

export const config = router({

  publicConfig: authProcedure
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

      const capabilities = await getCapabilities(envConfig.AUTH_INTERNAL_URL);
      const versionTag = readVersionFile()?.tag;
      const systemLanguageConfig = getSystemLanguageConfig(getCommonConfig().systemLanguage);

      return {
        ENABLE_CHANGE_PASSWORD: capabilities.changePassword,

        MIS_URL: envConfig.MIS_URL,

        PORTAL_URL: envConfig.PORTAL_URL,

        CLUSTERS: getSortedClusters(clusters).map((cluster) => ({ id: cluster.id, name: cluster.displayName })),

        CLUSTER_SORTED_ID_LIST: getSortedClusterIds(clusters),

        PASSWORD_PATTERN: commonConfig.passwordPattern?.regex,

        BASE_PATH: envConfig.NEXT_PUBLIC_RUNTIME_BASE_PATH,
        // 上传（请求）文件的大小限制
        CLIENT_MAX_BODY_SIZE: envConfig.CLIENT_MAX_BODY_SIZE,

        PUBLIC_PATH: envConfig.PUBLIC_PATH,

        NAV_LINKS: aiConfig.navLinks,

        USER_LINKS: commonConfig.userLinks,

        VERSION_TAG: versionTag,

        RUNTIME_I18N_CONFIG_TEXTS: {
          passwordPatternMessage: commonConfig.passwordPattern?.errorMessage,
        },

        SYSTEM_LANGUAGE_CONFIG: systemLanguageConfig,

        LOGIN_NODES: parseKeyValue(envConfig.LOGIN_NODES),

        NOVNC_CLIENT_URL: envConfig.NOVNC_CLIENT_URL,

      };
    }),

  getClusterConfig: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/config/cluster",
        tags: ["config"],
        summary: "clusterConfig",
      },
    })
    .input(z.object({ clusterId: z.string() }))
    .output(ClusterConfigSchema)
    .query(async ({ input }) => {
      const { clusterId } = input;

      const client = getAdapterClient(clusterId);
      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:`cluster ${clusterId} is not found`,
        });
      }
      return await asyncClientCall(client.config, "getClusterConfig", {});
    }),

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
});
