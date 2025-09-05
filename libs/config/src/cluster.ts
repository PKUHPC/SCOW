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

import { getDirConfig } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";
import { createI18nStringSchema, I18nStringType } from "src/i18n";
import { Logger } from "ts-log";

const CLUSTER_CONFIG_BASE_PATH = "clusters";

export const SimpleClusterSchema = Type.Object({
  clusterId: Type.String(),
  displayName: createI18nStringSchema({ description: "集群名称" }),
  priority: Type.Number({ description: "集群使用的优先级, 数字越小越先展示", default: Number.MAX_SAFE_INTEGER }),
});
export type SimpleClusterSchema = Static<typeof SimpleClusterSchema>;

export enum k8sRuntime {
  docker = "docker",
  containerd = "containerd",
}

const LoginNodeConfigSchema = Type.Object({
  name: createI18nStringSchema({ description: "登录节点展示名" }),
  address: Type.String({ description: "集群的登录节点地址" }),
  scowd: Type.Optional(Type.Object({
    port: Type.Number({ description: "scowd 端口号" }),
  }, { description: "scowd 相关配置" })),
});

export type LoginNodeConfigSchema = Static<typeof LoginNodeConfigSchema>;

export interface LoginNode {
  name: I18nStringType;
  address: string;
  scowdPort?: number;
}

export const getLoginNode =
  (loginNode: string | LoginNodeConfigSchema): LoginNode => {
    if (typeof loginNode === "string") {
      return { name: loginNode, address: loginNode, scowdPort: undefined };
    }

    return { ...loginNode, scowdPort: loginNode.scowd?.port };
  };

export type Cluster = {
  id: string
} & ClusterConfigSchema;

export const getSortedClusters = (clusters: Record<string, ClusterConfigSchema>): Cluster[] => {
  return Object.keys(clusters)
    .sort(
      (a, b) => {
        const aName = JSON.stringify(clusters[a].displayName);
        const bName = JSON.stringify(clusters[b].displayName);
        if (clusters[a].priority === clusters[b].priority) {
          return (
            aName > bName
              ? 1
              : aName === bName
                ? 0
                : -1
          );
        }
        return clusters[a].priority - clusters[b].priority;
      },
    ).map((id) => ({ id, ...clusters[id] }));
};

export const getSortedClusterIds = (clusters: Record<string, ClusterConfigSchema>): string[] => {
  return Object.keys(clusters)
    .sort(
      (a, b) => {
        return clusters[a].priority - clusters[b].priority;
      },
    );
};

export const LoginDeskopConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否启动登录节点上的桌面功能" }),
  wms: Type.Array(
    Type.Object({ name: Type.String({ description: "名称" }), wm: Type.String({ description: "wm值" }) })),
  maxDesktops: Type.Integer({ description: "每个登录节点上最多创建多少个vnc桌面" }),
  desktopsDir: Type.String({ description: "将创建的登录节点桌面信息的保存到什么位置。相对于用户的家目录" }),
  shadowDesk: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否配置有ShadowDesk远程控制工具", default: false }),
    proxyServer: Type.String({ description: "代理服务器的地址和端口，例如 '10.129.227.58:8765'" }),
    wms: Type.Array(Type.String({ description: "shadowdesk支持的桌面类型", default: ["xfce"]})),
    appId: Type.String({ description: "api对接请求头参数" }),
    appSecret: Type.String({ description: "api入参加签的秘钥" }),
  })),
});

export const StorageConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否开启存储配额管理", default: false }),
  paths: Type.Array(Type.String({ description: "集群共享存储挂在路径" }), { default: []}),
});

const TurboVncConfigSchema = Type.String({ description: "TurboVNC的安装路径" });

export type LoginDeskopConfigSchema = Static<typeof LoginDeskopConfigSchema>;
type TurboVncConfigSchema = Static<typeof TurboVncConfigSchema>;

export const ClusterConfigSchema = Type.Object({
  displayName: createI18nStringSchema({ description: "集群的显示名称" }),
  priority: Type.Number({ description: "集群使用的优先级, 数字越小越先展示", default: Number.MAX_SAFE_INTEGER }),
  adapterUrl: Type.String({ description: "调度器适配器服务地址" }),
  proxyGateway: Type.Optional(Type.Object({
    url: Type.String({ description: "代理网关节点监听URL" }),
    autoSetupNginx: Type.Boolean({ description: "是否自动配置nginx", default: false }),
  })),
  scowd: Type.Optional(Type.Object({
    enabled: Type.Optional(Type.Boolean({ description: "是否开启 scowd", default: false })),
  })),
  loginNodes: Type.Union([
    Type.Array(Type.String(), { description: "集群的登录节点地址", default: []}),
    Type.Array(LoginNodeConfigSchema),
  ]),
  loginDesktop: Type.Optional(LoginDeskopConfigSchema),
  turboVNCPath: Type.Optional(TurboVncConfigSchema),
  crossClusterFileTransfer: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否开启跨集群传输功能", default: false }),
    transferNode: Type.Optional(Type.String({ description: "跨集群传输文件的节点" })),
  })),

  hpc: Type.Object({
    enabled: Type.Boolean({ description: "是否在HPC中启用" }),
  }, { description: "集群在HPC中是否启用, 默认启用", default: { enabled: true } }),

  ai: Type.Object({
    enabled: Type.Boolean({ description: "是否在AI中启用" }),
  }, { description: "集群在AI中是否启用, 默认不启用", default: { enabled: false } }),

  k8s: Type.Optional(Type.Object({
    runtime: Type.Enum(k8sRuntime, { description: "k8s 集群运行时, ai系统的镜像功能的命令取决于该值, 可选 docker 或者 containerd",
      default: "containerd" }),
    kubeconfig: Type.Object({
      path: Type.String({ description: "集群 kubeconfig 文件路径" }),
    }, { description: "k8s 集群 kubeconfig 相关配置" }),
  }, { description: "k8s 集群配置" })),

  storage: Type.Optional(StorageConfigSchema),
});


export type ClusterConfigSchema = Static<typeof ClusterConfigSchema>;


export type ClusterType = "hpc" | "ai";

/**
 * @param
 * type: 获取的集群类型，如果不传则返回所有集群，如果传入则返回指定类型的集群，例如：["hpc", "ai"] 返回所有HPC和AI集群
 */
export type GetClusterConfigFn<T> = (baseConfigPath?: string, logger?: Logger, type?: ClusterType[]) => T;

export const getClusterConfigs: GetClusterConfigFn<Record<string, ClusterConfigSchema>> =
  (baseConfigPath, logger, clusterType) => {

    const types: ClusterType[] = clusterType ?? ["hpc", "ai"];

    const config = getDirConfig(
      ClusterConfigSchema,
      CLUSTER_CONFIG_BASE_PATH,
      baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH,
      logger,
    );

    // 检查所有集群配置下的登陆节点地址是否重复，如果重复扔出错误
    // 检查当 scowd enabled 时, scowd port 是否配置
    const uniqueAddressesList = new Set();
    const allAddressesList: string[] = [];
    for (const cluster in config) {
      if (Object.hasOwnProperty.call(config, cluster)) {
        const clusterInfo = config[cluster];
        if (clusterInfo && clusterInfo.loginNodes.length > 0) {

          clusterInfo.loginNodes.map((ln) => {
            if (typeof ln === "string") {
              uniqueAddressesList.add(ln);
              allAddressesList.push(ln);

              if (clusterInfo.scowd?.enabled) {
                throw new Error("If scowd is enabled, scowd port must be configured for each LoginNode.");
              }
            } else {
              uniqueAddressesList.add(ln.address);
              allAddressesList.push(ln.address);

              if (clusterInfo.scowd?.enabled && ln.scowd.port === undefined) {
                throw new Error("If scowd is enabled, scowd port must be configured for each LoginNode.");
              }
            }
          });
        }
      }
    }
    const isUnique = uniqueAddressesList.size === allAddressesList.length;
    if (!isUnique) {
      throw new Error("login node address must be unique across all clusters and all login nodes.");
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
