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
import { misConfig } from "src/server/config/mis";
import { uiConfig } from "src/server/config/ui";
import { router } from "src/server/trpc/def";
import { authProcedure, baseProcedure } from "src/server/trpc/procedure/base";
import { getAdapterClient } from "src/server/utils/clusters";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

const configPath = USE_MOCK ? join(__dirname, "config") : undefined;
const clustersInit = getClusterConfigs(configPath, console, ["ai"]);
Object.keys(clustersInit).map((id) => clustersInit[id].loginNodes = clustersInit[id].loginNodes.map(getLoginNode));
// 配置文件中的已配置集群
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
  autoDetectWhenUserNotSet: z.boolean(),
  enabledLanguages: z.array(z.string()),
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

const ScowResourceConfigSchema = z.object({
  enabled: z.boolean(),
  address: z.string(),
});

const UiExtensionConfigSchema = z.union([
  z.object({ url: z.string() }),
  z.array(z.object({
    name: z.string(),
    url: z.string(),
  })),
]);

const grafanaConfigSchema = z.object({
  enabled:z.boolean().optional(),
  isProxy:z.boolean().optional(),
  proxyUrl:z.string(),
  noProxyUrl:z.string(),
  dashboardId:z.string(),
  dashboardName:z.string(),
  panelIds:z.object({
    gpu: z.number(),
    gpuMemory: z.number(),
    cpu: z.number(),
    memory: z.number(),
    network: z.number(),
  }),
});

const PublicConfigSchema = z.object({
  ENABLE_CHANGE_PASSWORD: z.boolean().optional(),
  MIS_URL: z.string().optional(),
  PORTAL_URL: z.string().optional(),
  QUANTUM_URL: z.string().optional(),
  CLUSTERS: z.array(ClusterSchema),
  CLUSTER_SORTED_ID_LIST: z.array(z.string()),
  PASSWORD_PATTERN: z.string().optional(),
  BASE_PATH: z.string(),
  CLIENT_MAX_BODY_SIZE: z.string(),
  FILE_EDIT_SIZE: z.string().optional(),
  NON_EDITABLE_FILENAME_POSTFIXES: z.array(z.string()).optional(),
  FILE_PREVIEW_SIZE: z.string().optional(),
  PUBLIC_PATH: z.string(),
  NAV_LINKS: z.array(NavLinkSchema).optional(),
  USER_LINKS: z.array(UserLinkSchema).optional(),
  VERSION_TAG: z.string().optional(),
  RUNTIME_I18N_CONFIG_TEXTS: z.object({
    passwordPatternMessage: I18nStringTypeSchema.optional(),
  }),
  SYSTEM_LANGUAGE_CONFIG: SystemLanguageConfigSchema,
  LOGIN_NODES: z.record(z.string(), z.string()),
  NOVNC_CLIENT_URL: z.string(),
  SCOW_RESOURCE: ScowResourceConfigSchema.optional(),
  MAX_JOB_RUNNING_TIME_HOURS:z.number().optional(),
  DASHBOARD_USER_DISPLAY_MODE: z.union([
    z.literal("full"),
    z.literal("simplified"),
  ]).default("full"),
  NOTIF_ENABLED: z.boolean().optional(),
  NOTIF_NAME: z.string().optional(),
  NOTIF_ADDRESS: z.string().optional(),
  UI_EXTENSION: UiExtensionConfigSchema.optional(),
  INFER_ENABLED:z.boolean(),
  GRAFANA_CONFIG:grafanaConfigSchema.optional(),
  CLUSTERS_GRAFANA_CONFIG:z.record(z.string(), grafanaConfigSchema).optional(),
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
      darkModeColor: z.string().optional(),
    }).optional(),
    titleTag: z.string().optional(),
  }),
  defaultPrimaryColor: z.string().default(DEFAULT_PRIMARY_COLOR),

});

// 类型别名
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

export type Cluster = z.infer<typeof ClusterSchema>;

export type NavLink = z.infer<typeof NavLinkSchema>;

export type UiConfig = z.infer<typeof UiConfigSchema>;

export type LoginNodeConfig = z.infer<typeof LoginNodeConfigSchema>;

export const PartitionSchema = z.object({
  name: z.string(),
  memMb: z.number(),
  cores: z.number(),
  gpus: z.number(),
  idleCores: z.number(),
  idleGpus: z.number(),
  nodes: z.number(),
  qos: z.array(z.string()),
  comment: z.string().optional(),
  gpuType: z.string().optional(),
  vramMb: z.number().optional(),
  maxAcceleratorsPerPod:z.number().optional(),
  gpuModel: z.string().optional(),
  acceleratorDescriptions: z.array(z.string()),
  cpuModel: z.string().optional(),
});

const LoginNodeConfigSchema = z.union([
  z.array(z.string()),
  z.array(z.object({
    name: I18nStringTypeSchema,
    address: z.string(),
  })),
]);

const StorageConfigSchema = z.object({
  enabled: z.boolean(),
  paths: z.array(z.string()),
  replicaExist: z.boolean(),
});

const ClusterAiConfigSchema = z.object({
  devHost: z.object({
    enabled: z.boolean(),
    vscodeInfo: z.object({
      binPath: z.string(),
    }),
    maxRunningTimeHours: z.number().optional(),
  }),
  clusterPublicPath: z.string(),
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

      const grafanaCommonConfig = {
        proxyUrl: join(envConfig.MIS_URL,"/api/admin/monitor/getResourceStatus"),
        noProxyUrl:misConfig.clusterMonitor?.grafanaUrl ?? "",
        enabled:misConfig.clusterMonitor?.resourceStatus?.enabled,
        isProxy:misConfig.clusterMonitor?.resourceStatus?.proxy,
      };

      const buildGrafanaConfig = (jobMonitor?: { dashboardId: string; dashboardName: string; panelIds: {
        gpu: number; gpuMemory: number; cpu: number; memory: number; network: number
      } }) =>
        jobMonitor ? { ...jobMonitor, ...grafanaCommonConfig } : undefined;

      type GrafanaConfig = NonNullable<ReturnType<typeof buildGrafanaConfig>>;

      const clustersGrafanaConfig = Object.entries(clusters)
        .reduce<Record<string, GrafanaConfig>>((acc, [clusterId, cluster]) => {
          const grafanaConfig = buildGrafanaConfig(cluster.jobMonitor);
          if (grafanaConfig) {
            acc[clusterId] = grafanaConfig;
          }
          return acc;
        }, {});

      return {
        ENABLE_CHANGE_PASSWORD: capabilities.changePassword,

        MIS_URL: envConfig.MIS_URL,

        MIS_SERVER_URL: envConfig.MIS_SERVER_URL,

        PORTAL_URL: envConfig.PORTAL_URL,

        QUANTUM_URL: envConfig.QUANTUM_DEPLOYED ? envConfig.QUANTUM_URL : "",

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

        SCOW_RESOURCE: commonConfig.scowResource,

        FILE_EDIT_SIZE: aiConfig.file?.edit.limitSize,
        NON_EDITABLE_FILENAME_POSTFIXES: aiConfig.file?.edit.nonEditableFilenamePostfixes,
        FILE_PREVIEW_SIZE: aiConfig.file?.preview.limitSize,

        MAX_JOB_RUNNING_TIME_HOURS: aiConfig.maxJobRunningTimeHours,

        UI_EXTENSION: aiConfig.uiExtension,

        DASHBOARD_USER_DISPLAY_MODE: commonConfig.dashboard?.userDisplayMode ?? "full",

        NOTIF_ENABLED: commonConfig.notification?.enabled,

        NOTIF_NAME: commonConfig.notification?.name,

        NOTIF_ADDRESS: commonConfig.notification?.address,

        INFER_ENABLED: aiConfig.inferConfig?.enabled === false ? false : true,

        GRAFANA_CONFIG: buildGrafanaConfig(aiConfig.jobMonitor),
        CLUSTERS_GRAFANA_CONFIG: clustersGrafanaConfig,
      };
    }),
  getScowClusterConfig: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/config/scowCluster",
        tags: ["config"],
        summary: "ScowClusterConfig",
      },
    })
    .input(z.void())
    .output(z.record(z.string(), z.object({
      scowdEnabled: z.boolean(),
      storage: StorageConfigSchema,
      loginNodes: LoginNodeConfigSchema,
      ai: ClusterAiConfigSchema,
    })))
    .query(async () => {
      const clusterConfigs = Object.keys(clusters).reduce((acc, clusterId) => {
        const cluster = clusters[clusterId];
        acc[clusterId] = {
          scowdEnabled: cluster.scowd?.enabled ?? false,
          storage:{
            enabled:cluster.storage?.enabled ?? false,
            paths:cluster.storage?.paths ?? [],
            replicaExist: cluster.storage?.replicaExist ?? false,
          },
          loginNodes: cluster?.loginNodes,
          ai: {
            devHost: {
              enabled: cluster.ai.devHost?.enabled ?? false,
              vscodeInfo: cluster.ai?.devHost?.vscodeInfo ?? { binPath: "" },
              maxRunningTimeHours: cluster.ai?.devHost?.maxRunningTimeHours,
            },
            clusterPublicPath: cluster.ai?.clusterPublicPath ?? "",
          },
        };
        return acc;
      }, {} as Record<string, {
        scowdEnabled: boolean,
        storage: { enabled: boolean,paths: string[], replicaExist: boolean },
        loginNodes: LoginNodeConfig,
        ai: { devHost: { enabled: boolean, vscodeInfo: { binPath: string }, maxRunningTimeHours?: number },
          clusterPublicPath: string,
        },
      }>);

      return clusterConfigs;
    }),

  getAvailablePartitions: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/config/cluster/availablePartitions",
        tags: ["config"],
        summary: "GetAvailablePartitions",
      },
    })
    .input(z.object({ accountName: z.string(),clusterId:z.string() }))
    .output(z.array(PartitionSchema))
    .query(async ({ input:{ accountName, clusterId }, ctx: { user } }) => {
      const client = getAdapterClient(clusterId);
      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:`cluster ${clusterId} is not found`,
        });
      }
      const { partitions } = await asyncClientCall(client.config, "getAvailablePartitions", {
        accountName, userId: user.identityId,
      });

      const reply = await asyncClientCall(client.config, "getClusterInfo", {
        cluster: clusterId,
      });

      const idleMap = new Map<string, { idleCpuCount?: number; idleGpuCount?: number }>();
      reply.partitions?.forEach((partition) => {
        const key = (partition as any).partitionName ?? (partition as any).name;
        if (key) {
          idleMap.set(key, {
            idleCpuCount: (partition as any).idleCpuCount,
            idleGpuCount: (partition as any).idleGpuCount,
          });
        }
      });

      return partitions.map((partition) => {
        const idle = idleMap.get(partition.name);
        return {
          ...partition,
          idleCores: idle?.idleCpuCount ?? 0,
          idleGpus: idle?.idleGpuCount ?? 0,
        };
      });
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
