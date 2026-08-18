import { GenService, GenServiceMethods } from "@bufbuild/protobuf/codegenv2";
import { type Client, createClient } from "@connectrpc/connect";
import { ConnectTransportOptions, createConnectTransport, Http2SessionOptions } from "@connectrpc/connect-node";
import { AppService } from "@scow/scowd-protos/build/application/app_pb";
import { DesktopService } from "@scow/scowd-protos/build/application/desktop_pb";
import { ImageService } from "@scow/scowd-protos/build/application/image_pb";
import { ShellService } from "@scow/scowd-protos/build/application/shell_pb";
import { SystemService } from "@scow/scowd-protos/build/application/system_pb";
import { FileService } from "@scow/scowd-protos/build/storage/file_pb";
import { FileTransferService } from "@scow/scowd-protos/build/storage/file_transfer_pb";
import { StorageQuotaService } from "@scow/scowd-protos/build/storage/storage_quota_pb";
import { Logger } from "ts-log";

import { SslConfig } from "./ssl";

export interface ScowdClient {
  file: Client<typeof FileService>;
  storageQuota: Client<typeof StorageQuotaService>;
  desktop: Client<typeof DesktopService>;
  app: Client<typeof AppService>;
  system: Client<typeof SystemService>;
  shell: Client<typeof ShellService>;
  fileTransfer: Client<typeof FileTransferService>;
  image: Client<typeof ImageService>;
}
export type SafeConnectTransportOptions = Omit<ConnectTransportOptions, "httpVersion" | "baseUrl" | "nodeOptions"> &
  Http2SessionOptions;

// HTTP/2 keepalive 配置，用于检测半开连接（如 scowd 被 OOM kill 后 TCP RST 未送达的场景）
// connect-node 默认 pingIntervalMs=Infinity 且 pingIdleConnection=false，即永不主动探测连接存活性
const DEFAULT_PING_INTERVAL_MS = 30_000; // 每 30 秒发送 PING 帧探测连接是否存活
const DEFAULT_PING_TIMEOUT_MS = 5_000; // PING 发出后 5 秒内无响应则判定连接已死，触发重连
const DEFAULT_IDLE_CONNECTION_TIMEOUT_MS = 5 * 60_000; // 连接空闲 5 分钟后主动关闭（默认 15 分钟）

export function getClient<TService extends GenServiceMethods>(
  scowdUrl: string,
  service: GenService<TService>,
  certificates?: SslConfig,
  extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
): Client<GenService<TService>> {
  const transport = createConnectTransport({
    baseUrl: scowdUrl,
    httpVersion: "2",
    pingIntervalMs: DEFAULT_PING_INTERVAL_MS,
    pingTimeoutMs: DEFAULT_PING_TIMEOUT_MS,
    pingIdleConnection: true,
    idleConnectionTimeoutMs: DEFAULT_IDLE_CONNECTION_TIMEOUT_MS,
    nodeOptions: {
      ...certificates,
    },
    ...extraConnectTransportOptions,
  });
  return createClient(service, transport);
}

export const getScowdClient = (
  scowdUrl: string,
  certificates?: SslConfig,
  extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
) => {
  return {
    file: getClient(scowdUrl, FileService, certificates, extraConnectTransportOptions),
    fileTransfer: getClient(scowdUrl, FileTransferService, certificates, extraConnectTransportOptions),
    storageQuota: getClient(scowdUrl, StorageQuotaService, certificates, extraConnectTransportOptions),
    desktop: getClient(scowdUrl, DesktopService, certificates, extraConnectTransportOptions),
    app: getClient(scowdUrl, AppService, certificates, extraConnectTransportOptions),
    system: getClient(scowdUrl, SystemService, certificates, extraConnectTransportOptions),
    shell: getClient(scowdUrl, ShellService, certificates, extraConnectTransportOptions),
    image: getClient(scowdUrl, ImageService, certificates, extraConnectTransportOptions),
  } as ScowdClient;
};

export type ScowdClientByUrlGetter = (
  scowdUrl: string,
  extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
) => ScowdClient;

export function createScowdClientByUrlGetter(options: {
  certificates?: SslConfig;
  logger: Logger;
}): ScowdClientByUrlGetter {
  const clientCache = new Map<string, ScowdClient>();
  return (scowdUrl: string, extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>) => {
    const cacheKey = extraConnectTransportOptions
      ? `${scowdUrl}::${JSON.stringify(extraConnectTransportOptions)}`
      : scowdUrl;
    const cached = clientCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    options.logger.debug("Creating and caching new scowd client for %s", scowdUrl);
    const client = getScowdClient(scowdUrl, options.certificates, extraConnectTransportOptions);
    clientCache.set(cacheKey, client);
    return client;
  };
}

export type BalancedScowdClientGetter = (
  clusterId: string,
  userId?: string,
  extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
) => ScowdClient | undefined;

interface ScowdNode {
  address: string;
  scowdUrl: string;
}

export function createBalancedScowdClientGetter<TClusterInfo, TLoginNodeConfig, TLoginNode>(options: {
  getClusterInfo: (clusterId: string) => TClusterInfo | undefined;
  getClusterIds: () => string[];
  getLoginNodes: (clusterInfo: TClusterInfo | undefined) => TLoginNodeConfig[] | undefined;
  getLoginNode: (loginNodeConfig: TLoginNodeConfig) => TLoginNode;
  getLoginNodeAddress: (loginNode: TLoginNode) => string;
  getLoginNodeScowdUrl: (clusterId: string, host: string) => string | undefined;
  certificates?: SslConfig;
  healthCheckIntervalMs?: number;
  healthCheckTimeoutMs?: number;
  logger: Logger;
}): BalancedScowdClientGetter {
  const clientCache = new Map<string, ScowdClient>();
  const healthState = new Map<string, Map<string, boolean>>();
  let healthCheckStarted = false;
  const healthCheckIntervalMs = options.healthCheckIntervalMs ?? 30000;
  const healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? 5000;

  const getCacheKey = (
    scowdUrl: string,
    extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
  ): string => {
    if (!extraConnectTransportOptions) {
      return scowdUrl;
    }
    return `${scowdUrl}::${JSON.stringify(extraConnectTransportOptions)}`;
  };

  const getScowdClientByUrl = (
    scowdUrl: string,
    extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>,
  ): ScowdClient => {
    const cacheKey = getCacheKey(scowdUrl, extraConnectTransportOptions);
    const cached = clientCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    options.logger.debug("Creating and caching new scowd client for %s", scowdUrl);
    const client = getScowdClient(scowdUrl, options.certificates, extraConnectTransportOptions);
    clientCache.set(cacheKey, client);
    return client;
  };

  const getClusterNodes = (clusterId: string): ScowdNode[] => {
    const clusterInfo = options.getClusterInfo(clusterId);
    const loginNodes = options.getLoginNodes(clusterInfo) ?? [];
    return loginNodes
      .map((loginNodeConfig) => {
        const loginNode = options.getLoginNode(loginNodeConfig);
        const address = options.getLoginNodeAddress(loginNode);
        const scowdUrl = options.getLoginNodeScowdUrl(clusterId, address);
        if (!scowdUrl) {
          return undefined;
        }
        return { address, scowdUrl };
      })
      .filter((node): node is ScowdNode => !!node);
  };

  const getHealthyNodes = (clusterId: string, nodes: ScowdNode[]): ScowdNode[] => {
    const clusterHealth = healthState.get(clusterId);
    if (!clusterHealth) {
      return nodes;
    }
    const healthyNodes = nodes.filter((node) => clusterHealth.get(node.address));
    if (healthyNodes.length === 0) {
      options.logger.warn(
        "No healthy scowd nodes for cluster %s, falling back to all %d nodes",
        clusterId,
        nodes.length,
      );
      return nodes;
    }
    return healthyNodes;
  };

  const hashUserId = (userId: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < userId.length; i += 1) {
      hash ^= userId.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
  };

  const selectNode = (clusterId: string, userId?: string): ScowdNode | undefined => {
    const nodes = getClusterNodes(clusterId);
    if (nodes.length === 0) {
      return undefined;
    }
    const candidates = getHealthyNodes(clusterId, nodes);
    if (userId) {
      const index = hashUserId(userId) % candidates.length;
      return candidates[index];
    }
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  };

  const checkNodeHealth = async (node: ScowdNode): Promise<boolean> => {
    try {
      const client = getScowdClientByUrl(node.scowdUrl);
      await client.system.checkHealth({}, { timeoutMs: healthCheckTimeoutMs });
      return true;
    } catch {
      return false;
    }
  };

  const refreshClusterHealth = async (clusterId: string): Promise<void> => {
    const nodes = getClusterNodes(clusterId);
    if (nodes.length === 0) {
      return;
    }
    const results = await Promise.all(
      nodes.map(async (node) => ({
        address: node.address,
        healthy: await checkNodeHealth(node),
      })),
    );
    const clusterHealth = new Map<string, boolean>();
    results.forEach((r) => clusterHealth.set(r.address, r.healthy));
    healthState.set(clusterId, clusterHealth);

    const unhealthyNodes = results.filter((r) => !r.healthy);
    unhealthyNodes.forEach((r) => {
      options.logger.warn("Scowd node %s in cluster %s is unhealthy", r.address, clusterId);
    });
    const healthyCount = results.length - unhealthyNodes.length;
    options.logger.debug(
      "Scowd health check for cluster %s: %d/%d nodes healthy",
      clusterId,
      healthyCount,
      results.length,
    );
  };

  const refreshAllHealth = async (): Promise<void> => {
    const clusterIds = options.getClusterIds();
    await Promise.all(clusterIds.map((clusterId) => refreshClusterHealth(clusterId)));
  };

  const ensureHealthCheckLoop = (): void => {
    if (healthCheckStarted) {
      return;
    }
    healthCheckStarted = true;
    options.logger.debug(
      "Starting scowd balanced health check loop, interval=%dms timeout=%dms",
      healthCheckIntervalMs,
      healthCheckTimeoutMs,
    );
    void refreshAllHealth();
    setInterval(() => {
      void refreshAllHealth();
    }, healthCheckIntervalMs);
  };

  return (clusterId: string, userId?: string, extraConnectTransportOptions?: Partial<SafeConnectTransportOptions>) => {
    ensureHealthCheckLoop();
    const node = selectNode(clusterId, userId);
    if (!node) {
      return undefined;
    }
    options.logger.debug(
      "Routing scowd request: cluster=%s user=%s → node=%s",
      clusterId,
      userId ?? "(no userId)",
      node.address,
    );
    return getScowdClientByUrl(node.scowdUrl, extraConnectTransportOptions);
  };
}
