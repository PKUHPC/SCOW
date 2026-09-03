import { Code, ConnectError } from "@connectrpc/connect";
import {
  createAdapterCertificates,
  getSchedulerAdapterClient,
  SchedulerAdapterClient,
} from "@scow/lib-scheduler-adapter";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { Logger } from "pino";
import { config } from "src/server/config/env";
import { getScowClusterConfigs } from "src/server/mis-server/cluster";

interface ClusterConfigSchema {
  adapterUrl: string;
}

type CallOnAllResult<T> = {
  cluster: string;
  result: T;
}[];

// Throw ServiceError if failed.
type CallOnAll = <T>(
  // clusters for calling to connect to adapter client
  clusters: Record<string, ClusterConfigSchema>,
  logger: Logger,
  call: (client: SchedulerAdapterClient) => Promise<T>,
) => Promise<CallOnAllResult<T>>;

type CallOnOne = <T>(
  cluster: string,
  logger: Logger,
  call: (client: SchedulerAdapterClient) => Promise<T>,
) => Promise<T>;

export const CLUSTEROPS_ERROR_CODE = "CLUSTEROPS_ERROR";
export const ADAPTER_CALL_ON_ONE_ERROR = "ADAPTER_CALL_ON_ONE_ERROR";

export const certificates = createAdapterCertificates(config);

// 单独调用某适配器接口，或统一调用所有调度器适配器接口
// 在资源管理服务中错误将会以Connect Error形式抛出
export async function getClusterUtils() {
  const configClusters = await getScowClusterConfigs();
  // adapterClient of all config clusters
  const adapterClientForClusters = Object.entries(configClusters.clusterConfigs).reduce(
    (prev, [_, c]) => {
      const client = getSchedulerAdapterClient(c.adapterUrl, certificates, {
        timeoutMs: config.ADAPTER_TIMEOUT_SECONDS * 1000,
      });

      prev[c.clusterId] = client;

      return prev;
    },
    {} as Record<string, SchedulerAdapterClient>,
  );

  // adapterClients of activated clusters
  const getAdapterClientForActivatedClusters = (clustersParam: Record<string, ClusterConfigSchema>) => {
    return Object.entries(clustersParam).reduce(
      (prev, [cluster, c]) => {
        const client = getSchedulerAdapterClient(c.adapterUrl, certificates, {
          timeoutMs: config.ADAPTER_TIMEOUT_SECONDS * 1000,
        });
        prev[cluster] = client;
        return prev;
      },
      {} as Record<string, SchedulerAdapterClient>,
    );
  };

  const getAdapterClient = (cluster: string) => {
    return adapterClientForClusters[cluster];
  };

  const clustersUtils = {
    getAdapterClient: (cluster: string) => {
      return adapterClientForClusters[cluster];
    },

    callOnOne: (async (cluster, logger, call) => {
      const client = getAdapterClient(cluster);

      if (!client) {
        throw new Error("Calling actions on non-existing cluster " + cluster);
      }

      logger.info("Calling actions on cluster " + cluster);

      return await call(client).catch((e) => {
        logger.error("Cluster ops fails at %o", e);

        const errorDetail = e instanceof Error ? e : JSON.stringify(e);

        const reason = "Cluster ID : " + cluster + ", Details : " + errorDetail.toString();
        const clusterErrorDetails = [
          {
            clusterId: cluster,
            details: errorDetail,
          },
        ];

        // 为兼容TRPC和ConnectRpc调用，扔出ConnectError
        throw new ConnectError(
          reason,
          Code.Internal,
          scowErrorMetadata(ADAPTER_CALL_ON_ONE_ERROR, {
            clusterErrors: JSON.stringify(clusterErrorDetails),
          }),
        );
      });
    }) as CallOnOne,

    // throws error if failed.
    callOnAll: (async (clusters, logger, call) => {
      const adapterClientForActivatedClusters = getAdapterClientForActivatedClusters(clusters);

      const responses = await Promise.all(
        Object.entries(adapterClientForActivatedClusters).map(async ([cluster, client]) => {
          return call(client)
            .then((result) => {
              logger.info("Executing on %s success", cluster);
              return { cluster, success: true, result };
            })
            .catch((e) => {
              logger.error(e, "Executing on %s failed", cluster);
              return { cluster, success: false, error: e };
            });
        }),
      );

      interface SuccessResponse<T> {
        cluster: string;
        success: boolean;
        result: T;
      }
      interface ErrorResponse {
        cluster: string;
        success: boolean;
        error: any;
      }

      function isSuccessResponse<T>(response: SuccessResponse<T> | ErrorResponse): response is SuccessResponse<T> {
        return response.success === true;
      }

      function isErrorResponse(response: SuccessResponse<any> | ErrorResponse): response is ErrorResponse {
        return response.success === false;
      }

      const results = responses.filter(isSuccessResponse).map(({ cluster, result }) => ({ cluster, result }));
      const failed = responses.filter(isErrorResponse).map(({ cluster, error }) => ({ cluster, error }));

      if (failed.length > 0) {
        logger.error("Cluster ops fails at clusters %o", failed);
        const reason = failed.map((x) => "Cluster ID : " + x.cluster + ", Details : " + x.error).join("; ");

        const clusterErrorDetails = failed.map((x) => ({
          clusterId: x.cluster,
          details: x.error,
        }));

        // 为兼容TRPC和ConnectRpc调用，扔出ConnectError
        throw new ConnectError(
          reason,
          Code.Internal,
          scowErrorMetadata(CLUSTEROPS_ERROR_CODE, {
            clusterErrors: JSON.stringify(clusterErrorDetails),
          }),
        );
      }

      return results;
    }) as CallOnAll,
  };

  return clustersUtils;
}
