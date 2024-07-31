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

import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger, plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { ClusterConfigSchema, getLoginNode } from "@scow/config/build/cluster";
import { getSchedulerAdapterClient, SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { testRootUserSshLogin } from "@scow/lib-ssh";
import { getActivatedClusters, updateCluster } from "src/bl/clustersUtils";
import { configClusters } from "src/config/clusters";
import { rootKeyPair } from "src/config/env";

type CallOnAllResult<T> = {
  cluster: string;
  result: T
}[];

type CallOnAllWithoutClusterId = <T>(
  // clusters for calling to connect to adapter client
  clusters: Record<string, ClusterConfigSchema>,
  logger: Logger,
  call: (
    client: SchedulerAdapterClient,
  ) => Promise<T>,
) => Promise<CallOnAllResult<T>>;


type CallOnAllWithClusterId = <T>(
  // clusters for calling to connect to adapter client
  clusters: Record<string, ClusterConfigSchema>,
  logger: Logger,
  call: (
    client: SchedulerAdapterClient,
    cluster: string,
  ) => Promise<T>,
) => Promise<CallOnAllResult<T>>;

// CallOnAll重载
// Throw ServiceError if failed.
type CallOnAll = CallOnAllWithClusterId & CallOnAllWithoutClusterId;

type CallOnOne = <T>(
  cluster: string,
  logger: Logger,
  call: (client: SchedulerAdapterClient) => Promise<T>,
) => Promise<T>;

export interface ClusterPlugin {
  clusters: {
    callOnAll: CallOnAll;
    callOnOne: CallOnOne;
  }
};

export const CLUSTEROPS_ERROR_CODE = "CLUSTEROPS_ERROR";
export const ADAPTER_CALL_ON_ONE_ERROR = "ADAPTER_CALL_ON_ONE_ERROR";

export const clustersPlugin = plugin(async (f) => {

  // initial clusters database
  const configClusterIds = Object.keys(configClusters);
  await updateCluster(f.ext.orm.em.fork(), configClusterIds, f.logger);

  if (process.env.NODE_ENV === "production") {

    // only check activated clusters' root user login when system is starting
    const activatedClusters = await getActivatedClusters(f.ext.orm.em.fork(), f.logger).catch((e) => {
      f.logger.info("!!![important] No available activated clusters.This will skip root ssh login check in cluster!!!");
      f.logger.info(e);
      return {};
    });

    await Promise.all(Object.values(activatedClusters).map(async ({ displayName, loginNodes }) => {
      const loginNode = getLoginNode(loginNodes[0]);
      const address = loginNode.address;
      const node = loginNode.name;
      f.logger.info("Checking if root can login to %s by login node %s", displayName, node);
      const error = await testRootUserSshLogin(address, rootKeyPair, f.logger);
      if (error) {
        f.logger.info("Root cannot login to %s by login node %s. err: %o", displayName, node, error);
        throw error;
      } else {
        f.logger.info("Root can login to %s by login node %s", displayName, node);
      }
    }));

  }

  // adapterClient of all config clusters
  const adapterClientForClusters = Object.entries(configClusters).reduce((prev, [cluster, c]) => {
    const client = getSchedulerAdapterClient(c.adapterUrl);

    prev[cluster] = client;

    return prev;
  }, {} as Record<string, SchedulerAdapterClient>);

  // adapterClients of activated clusters
  const getAdapterClientForActivatedClusters = (clustersParam: Record<string, ClusterConfigSchema>) => {
    return Object.entries(clustersParam).reduce((prev, [cluster, c]) => {
      const client = getSchedulerAdapterClient(c.adapterUrl);
      prev[cluster] = client;
      return prev;
    }, {} as Record<string, SchedulerAdapterClient>);
  };

  const getAdapterClient = (cluster: string) => {
    return adapterClientForClusters[cluster];
  };

  f.logger.child({ plugin: "cluster" });

  const clustersPlugin = {

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
        const clusterErrorDetails = [{
          clusterId: cluster,
          details: errorDetail,
        }];

        // 统一错误处理
        if (e instanceof Error) {
          throw new ServiceError({
            code: status.INTERNAL,
            details: reason,
            metadata: scowErrorMetadata(ADAPTER_CALL_ON_ONE_ERROR,
              { clusterErrors: JSON.stringify(clusterErrorDetails) }),
          });
        // 如果是已经封装过的grpc error, 直接抛出错误
        } else {
          throw e;
        }

      });
    }) as CallOnOne,

    // throws error if failed.
    callOnAll: (async (clusters, logger, call) => {

      const adapterClientForActivatedClusters = getAdapterClientForActivatedClusters(clusters);

      const responses = await Promise.all(Object.entries(adapterClientForActivatedClusters)
        .map(async ([cluster, client]) => {
          return call(client, cluster).then((result) => {
            logger.info("Executing on %s success", cluster);
            return { cluster, success: true, result };
          }).catch((e) => {
            logger.error(e, "Executing on %s failed", cluster);
            return { cluster, success: false, error: e };
          });
        }));

      interface SuccessResponse<T> { cluster: string; success: boolean; result: T; }
      interface ErrorResponse { cluster: string; success: boolean; error: any; }

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

        throw new ServiceError({
          code: status.INTERNAL,
          details: reason,
          metadata: scowErrorMetadata(CLUSTEROPS_ERROR_CODE, { clusterErrors: JSON.stringify(clusterErrorDetails) }),
        });
      }

      return results;

    }) as CallOnAll,
  };

  f.addExtension("clusters", clustersPlugin);
});
