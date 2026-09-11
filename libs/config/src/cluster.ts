import { getDirConfig } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { createI18nStringSchema, I18nStringType } from "src/i18n";
import { Logger } from "ts-log";

import { DEFAULT_CONFIG_BASE_PATH } from "./constants";
import { getServerStorageConfig } from "./storage";

const CLUSTER_CONFIG_BASE_PATH = "clusters";

export const SimpleClusterSchema = Type.Object({
  clusterId: Type.String(),
  displayName: createI18nStringSchema({ description: "集群名称" }),
  priority: Type.Number({
    description: "集群使用的优先级, 数字越小越先展示",
    default: Number.MAX_SAFE_INTEGER,
  }),
});
export type SimpleClusterSchema = Static<typeof SimpleClusterSchema>;

export enum k8sRuntime {
  docker = "docker",
  containerd = "containerd",
}

const LoginNodeConfigSchema = Type.Object({
  name: createI18nStringSchema({ description: "登录节点展示名" }),
  address: Type.String({ description: "集群的登录节点地址" }),
  scowd: Type.Object(
    {
      port: Type.Integer({ description: "scowd 端口号", minimum: 1, maximum: 65535 }),
    },
    { description: "scowd 相关配置" },
  ),
});

export type LoginNodeConfigSchema = Static<typeof LoginNodeConfigSchema>;

export interface LoginNode {
  name: I18nStringType;
  address: string;
  scowdPort: number;
}

export const getLoginNode = (loginNode: LoginNodeConfigSchema): LoginNode => {
  const scowdPort = loginNode?.scowd?.port;

  if (typeof scowdPort !== "number") {
    const loginNodeName = loginNode?.address ?? "unknown";
    throw new Error(`Login node "${loginNodeName}" is missing required configuration "loginNodes[].scowd.port".`);
  }

  return { ...loginNode, scowdPort };
};

export type Cluster = {
  id: string;
} & ClusterConfigSchema;

export const getSortedClusters = (clusters: Record<string, ClusterConfigSchema>): Cluster[] => {
  return Object.keys(clusters)
    .sort((a, b) => {
      const aName = JSON.stringify(clusters[a].displayName);
      const bName = JSON.stringify(clusters[b].displayName);
      if (clusters[a].priority === clusters[b].priority) {
        return aName > bName ? 1 : aName === bName ? 0 : -1;
      }
      return clusters[a].priority - clusters[b].priority;
    })
    .map((id) => ({ id, ...clusters[id] }));
};

export const getSortedClusterIds = (clusters: Record<string, ClusterConfigSchema>): string[] => {
  return Object.keys(clusters).sort((a, b) => {
    return clusters[a].priority - clusters[b].priority;
  });
};

export const LoginDeskopConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否启动登录节点上的桌面功能" }),
  wms: Type.Array(
    Type.Object({
      name: Type.String({ description: "名称" }),
      wm: Type.String({ description: "wm值" }),
    }),
  ),
  maxDesktops: Type.Integer({ description: "每个登录节点上最多创建多少个vnc桌面" }),
  desktopsDir: Type.String({
    description: "将创建的登录节点桌面信息的保存到什么位置。相对于用户的家目录",
  }),
  shadowDesk: Type.Optional(
    Type.Object({
      enabled: Type.Boolean({ description: "是否配置有ShadowDesk远程控制工具", default: false }),
      proxyServer: Type.String({
        description: "代理服务器的地址和端口，例如 '10.129.227.58:8765'",
      }),
      wms: Type.Array(Type.String({ description: "shadowdesk支持的桌面类型", default: ["xfce"] })),
      appId: Type.String({ description: "api对接请求头参数" }),
      appSecret: Type.String({ description: "api入参加签的秘钥" }),
    }),
  ),
});

const TurboVncConfigSchema = Type.String({ description: "TurboVNC的安装路径" });

export type LoginDeskopConfigSchema = Static<typeof LoginDeskopConfigSchema>;
type TurboVncConfigSchema = Static<typeof TurboVncConfigSchema>;

/** 集群下快捷路径入口定义 */
export const PathEntrySchema = Type.Object({
  displayName: createI18nStringSchema({ description: "快捷路径入口显示名称" }),
  pathTemplate: Type.String({ description: "路径模板, 支持 {{mountPath}} 和 {{userId}}" }),
});

/** 单个快捷入口定义（集群级别） */
export const StorageEntrySchema = Type.Object({
  storageId: Type.String({ description: "对应 storage.yaml 中的 storageId" }),
  mountPath: Type.String({ description: "当前存储在此集群的挂载路径" }),
  paths: Type.Optional(Type.Array(PathEntrySchema, { description: "快捷路径入口列表", default: [] })),
});

export type PathEntrySchema = Static<typeof PathEntrySchema>;
export type StorageEntrySchema = Static<typeof StorageEntrySchema>;

export enum IdmapMode {
  notSet = "notSet",
  plain = "plain",
  idmap = "idmap",
  bindfs = "bindfs",
}

const AIIdmapConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否开启AI用户ID映射功能，默认关闭", default: false }),
  mode: Type.Enum(IdmapMode, { description: "CSI的挂载模式，如果没有设置认为是 notSet", default: IdmapMode.notSet }),
});
export type AIIdmapConfigSchema = Static<typeof AIIdmapConfigSchema>;

export const ClusterConfigSchema = Type.Object({
  displayName: createI18nStringSchema({ description: "集群的显示名称" }),
  priority: Type.Number({
    description: "集群使用的优先级, 数字越小越先展示",
    default: Number.MAX_SAFE_INTEGER,
  }),
  adapterUrl: Type.String({ description: "调度器适配器服务地址" }),
  proxyGateway: Type.Optional(
    Type.Object({
      url: Type.String({ description: "代理网关节点监听URL" }),
      autoSetupNginx: Type.Boolean({ description: "是否自动配置nginx", default: false }),
    }),
  ),
  loginNodes: Type.Array(LoginNodeConfigSchema, { description: "集群的登录节点", minItems: 1 }),
  loginDesktop: Type.Optional(LoginDeskopConfigSchema),
  turboVNCPath: Type.Optional(TurboVncConfigSchema),
  crossClusterFileTransfer: Type.Optional(
    Type.Object({
      enabled: Type.Boolean({ description: "是否开启跨集群传输功能", default: false }),
      transferNode: Type.Optional(Type.String({ description: "跨集群传输文件的节点" })),
    }),
  ),

  hpc: Type.Object(
    {
      enabled: Type.Boolean({ description: "是否在HPC中启用" }),
      job: Type.Optional(
        Type.Object(
          {
            maxRunningTimeHours: Type.Optional(
              Type.Number({
                description: "HPC作业最长运行时间，单位小时。超过此时间则不能成功提交作业。不填为不限制",
              }),
            ),
          },
          { description: "HPC作业集群个性化配置" },
        ),
      ),
      app: Type.Optional(
        Type.Object(
          {
            maxRunningTimeHours: Type.Optional(
              Type.Number({
                description: "HPC应用最长运行时间，单位小时。超过此时间则不能成功提交作业。不填为不限制",
              }),
            ),
          },
          { description: "HPC应用集群个性化配置" },
        ),
      ),
    },
    { description: "集群在HPC中是否启用, 默认启用", default: { enabled: true } },
  ),

  ai: Type.Object(
    {
      enabled: Type.Boolean({ description: "是否在AI中启用" }),
      app: Type.Optional(
        Type.Object(
          {
            maxRunningTimeHours: Type.Optional(
              Type.Number({
                description: "AI应用最长运行时间，单位小时。超过此时间则不能成功提交作业。不填为不限制",
              }),
            ),
          },
          { description: "AI应用作业集群个性化配置" },
        ),
      ),
      train: Type.Optional(
        Type.Object(
          {
            maxRunningTimeHours: Type.Optional(
              Type.Number({
                description: "AI训练最长运行时间，单位小时。超过此时间则不能成功提交作业。不填为不限制",
              }),
            ),
          },
          { description: "AI训练作业集群个性化配置" },
        ),
      ),
      infer: Type.Optional(
        Type.Object(
          {
            maxRunningTimeHours: Type.Optional(
              Type.Number({
                description: "AI推理最长运行时间，单位小时。超过此时间则不能成功提交作业。不填为不限制",
              }),
            ),
          },
          { description: "AI推理作业集群个性化配置" },
        ),
      ),
      devHost: Type.Optional(
        Type.Object(
          {
            enabled: Type.Optional(Type.Boolean({ description: "是否开启开发机功能", default: false })),
            vscodeInfo: Type.Object({
              binPath: Type.String({ description: "vscode二进制路径" }),
            }),
            maxRunningTimeHours: Type.Optional(
              Type.Number({
                description: "开发机最长运行时间，单位小时。超过此时间则不能成功创建开发机。不填为不限制",
              }),
            ),
          },
          { description: "开发机功能配置" },
        ),
      ),
      clusterPublicPath: Type.Optional(
        Type.String({
          description: "公共数据资产目录路径, 配置生效后请勿随意修改，否则已有的公共数据资产将无法正常使用",
        }),
      ),

      sharedTopDir: Type.Optional(Type.String({ description: "分享数据资产的文件夹所在的目录" })),

      idmap: Type.Optional(AIIdmapConfigSchema),
    },
    { description: "集群在AI中是否启用, 默认不启用", default: { enabled: false } },
  ),

  entryPaths: Type.Optional(Type.Array(StorageEntrySchema, { description: "集群挂载的存储入口列表", default: [] })),
  description: Type.Optional(createI18nStringSchema({ description: "集群描述" })),
  publicMountPoints: Type.Optional(
    Type.Array(Type.String({ description: "公共挂载点" }), {
      description: "公共挂载点数组，全部会被挂载进AI应用和训练",
    }),
  ),

  inferConfig: Type.Optional(
    Type.Object({
      proxyHost: Type.Optional(Type.String({ description: "推理服务代理地址，可选配置，不配置时用scow节点地址转发" })),
    }),
  ),

  jobMonitor: Type.Optional(
    Type.Object({
      dashboardId: Type.String({ description: "grafana的dashboardId" }),
      dashboardName: Type.String({ description: "grafana的dashboardName" }),
      panelIds: Type.Object(
        {
          gpu: Type.Number(),
          gpuMemory: Type.Number(),
          cpu: Type.Number(),
          memory: Type.Number(),
          network: Type.Number(),
        },
        {
          description:
            "作业监控中要展示的panelId, 每个字段对应一个面板 ID, 由grafana的规则决定, 依次是GPU、显存、CPU、内存利用率, 网络使用情况",
          default: {
            gpu: 4,
            gpuMemory: 10,
            cpu: 24,
            memory: 26,
            network: 46,
          },
        },
      ),
    }),
  ),
});

export type ClusterConfigSchema = Static<typeof ClusterConfigSchema>;

export type ClusterType = "hpc" | "ai";

/**
 * @param
 * type: 获取的集群类型，如果不传则返回所有集群，如果传入则返回指定类型的集群，例如：["hpc", "ai"] 返回所有HPC和AI集群
 */
export type GetClusterConfigFn<T> = (baseConfigPath?: string, logger?: Logger, type?: ClusterType[]) => T;

/** 集群配置校验失败时抛出，携带结构化字段供调用方 instanceof 判断 */
export class ClusterEntryPathsConfigError extends Error {
  constructor(
    public readonly clusterId: string,
    public readonly reason: string,
    public readonly context?: { storageId?: string; pathTemplate?: string },
  ) {
    super(`Cluster ${clusterId}: ${reason}`);
    this.name = "ClusterEntryPathsConfigError";
  }
}

const ALLOWED_PATH_TEMPLATE_PLACEHOLDERS = new Set(["mountPath", "userId"]);

function validatePathTemplate(pathTemplate: string): string[] {
  const errors: string[] = [];

  // ========== 1. 路径遍历攻击 ==========
  // 替换占位符后检查，因为占位符本身不是路径段
  const withoutPlaceholders = pathTemplate.replace(/\{\{[^{}]+\}\}/g, "PLACEHOLDER");

  // 禁止 . 路径段。快捷路径不应该配置隐藏路径
  if (/(?:^|\/)\.(\/|$)/.test(withoutPlaceholders)) {
    errors.push("path must not contain '.' segments");
  }
  // 禁止 .. 路径遍历
  if (/(?:^|\/)\.\.(\/|$)/.test(withoutPlaceholders)) {
    errors.push("path must not contain '..' segments (path traversal)");
  }

  // ========== 2. 必须是绝对路径 ==========
  // 模板展开后应该是绝对路径，所以要么以 / 开头，要么以 {{mountPath}} 开头
  if (!pathTemplate.startsWith("/") && !pathTemplate.startsWith("{{mountPath}}")) {
    errors.push("path must be absolute (start with '/' or '{{mountPath}}')");
  }

  // ========== 3. 禁止空段和特殊字符 ==========
  // 连续斜杠 //
  if (/\/{2,}/.test(withoutPlaceholders)) {
    errors.push("path must not contain consecutive slashes '//'");
  }

  // 空字节注入
  if (pathTemplate.includes("\0")) {
    errors.push("path must not contain null bytes");
  }

  // 不可见/控制字符
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(pathTemplate)) {
    errors.push("path must not contain control characters");
  }
  // ========== 4. 禁止空段和特殊字符 ==========
  const placeholderRegex = /\{\{([^{}]+)\}\}|\{([^{}]+)\}/g;

  for (const match of pathTemplate.matchAll(placeholderRegex)) {
    const rawPlaceholder = match[0];
    const placeholderName = (match[1] ?? match[2])?.trim();

    if (!placeholderName) {
      continue;
    }

    if (rawPlaceholder !== `{{${placeholderName}}}`) {
      errors.push(
        `placeholder ${rawPlaceholder} must use the {{name}} format; only {{mountPath}} and {{userId}} are supported`,
      );
      continue;
    }

    if (!ALLOWED_PATH_TEMPLATE_PLACEHOLDERS.has(placeholderName)) {
      errors.push(`placeholder {{${placeholderName}}} is not supported; only {{mountPath}} and {{userId}} are allowed`);
    }
  }

  const sanitizedTemplate = pathTemplate.replace(/\{\{[^{}]+\}\}/g, "");
  if (sanitizedTemplate.includes("{") || sanitizedTemplate.includes("}")) {
    errors.push("contains malformed placeholders; only {{mountPath}} and {{userId}} are allowed");
  }

  return errors;
}

export const getClusterConfigs: GetClusterConfigFn<Record<string, ClusterConfigSchema>> = (
  baseConfigPath,
  logger,
  clusterType,
) => {
  const types: ClusterType[] = clusterType ?? ["hpc", "ai"];

  const config = getDirConfig(
    ClusterConfigSchema,
    CLUSTER_CONFIG_BASE_PATH,
    baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH,
    logger,
  );

  const storageConfig = getServerStorageConfig(baseConfigPath, logger);
  const validStorageIds =
    storageConfig.storages.length > 0 ? new Set(storageConfig.storages.map((s) => s.storageId)) : null;

  // 检查所有集群配置下的登陆节点地址是否重复，如果重复扔出错误
  const uniqueAddressesList = new Set();
  const allAddressesList: string[] = [];
  for (const cluster in config) {
    if (Object.hasOwnProperty.call(config, cluster)) {
      const clusterInfo = config[cluster];
      if (clusterInfo && clusterInfo.loginNodes.length > 0) {
        clusterInfo.loginNodes.map((ln) => {
          uniqueAddressesList.add(ln.address);
          allAddressesList.push(ln.address);
        });
      }
    }
  }
  const isUnique = uniqueAddressesList.size === allAddressesList.length;
  if (!isUnique) {
    throw new Error("login node address must be unique across all clusters and all login nodes.");
  }

  // 校验各集群 entryPaths 中 storageId、mountPath 的唯一性以及 pathTemplate 占位符合法性
  for (const cluster in config) {
    if (Object.hasOwnProperty.call(config, cluster)) {
      const clusterInfo = config[cluster];
      if (clusterInfo?.entryPaths && clusterInfo.entryPaths.length > 0) {
        // 校验 storageId 不能重复
        const storageIds = clusterInfo.entryPaths.map((e) => e.storageId);
        if (new Set(storageIds).size !== storageIds.length) {
          throw new ClusterEntryPathsConfigError(cluster, "duplicate storageId found in entryPaths");
        }

        // 校验 storageId 必须在 storage.yaml 中存在（仅当 storage.yaml 已配置时）
        if (validStorageIds) {
          for (const storageId of storageIds) {
            if (!validStorageIds.has(storageId)) {
              throw new ClusterEntryPathsConfigError(
                cluster,
                `storageId "${storageId}" in entryPaths is not defined in storage.yaml`,
                { storageId },
              );
            }
          }
        }

        // 校验 mountPath 必须是绝对路径
        for (const entry of clusterInfo.entryPaths) {
          if (!entry.mountPath.startsWith("/")) {
            throw new ClusterEntryPathsConfigError(
              cluster,
              `storageId "${entry.storageId}": mountPath "${entry.mountPath}" must be an absolute path (must start with /)`,
              { storageId: entry.storageId },
            );
          }
        }

        // 校验 mountPath 不能完全相同
        const mountPaths = clusterInfo.entryPaths.map((e) => e.mountPath);
        if (new Set(mountPaths).size !== mountPaths.length) {
          throw new ClusterEntryPathsConfigError(cluster, "duplicate mountPath found in entryPaths");
        }
        // 校验 pathTemplate 合法性
        for (const entry of clusterInfo.entryPaths) {
          for (const path of entry.paths ?? []) {
            const errors = validatePathTemplate(path.pathTemplate);
            if (errors.length > 0) {
              throw new ClusterEntryPathsConfigError(
                cluster,
                `storageId ${entry.storageId}, pathTemplate "${path.pathTemplate}": ${errors.join("; ")}`,
                { storageId: entry.storageId, pathTemplate: path.pathTemplate },
              );
            }
          }
        }
      }
    }
  }

  for (const cluster in config) {
    if (Object.hasOwnProperty.call(config, cluster)) {
      const clusterInfo = config[cluster];
      if (clusterInfo) {
        let enabled = false;
        for (const type of types) {
          if (clusterInfo[type].enabled) {
            enabled = true;
            break;
          }
        }
        if (!enabled) {
          delete config[cluster];
        }
      }
    }
  }

  return config;
};
