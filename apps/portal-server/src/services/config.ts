import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { moneyToNumber } from "@scow/lib-decimal";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource/build/utils";
import {
  convertClusterConfigsToServerProtoType,
  getClientFn,
  libGetCurrentActivatedClusters,
  libGetUserInfo,
  NO_CLUSTERS,
} from "@scow/lib-server";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { ConfigServiceServer, ConfigServiceService, Partition } from "@scow/protos/build/common/config";
import {
  AccountUnavailableReason,
  ConfigServiceServer as runTimeConfigServiceServer,
  ConfigServiceService as runTimeConfigServiceService,
} from "@scow/protos/build/portal/config";
import { AccountState, AccountStatus, UserServiceClient, UserStatus } from "@scow/protos/build/server/user";
import { readFileSync } from "fs";
import { join } from "path";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
import { callOnOne, checkActivatedClusters } from "src/utils/clusters";

export const getAccountUnavailableReasons = (accountStatus: AccountStatus | undefined) => {
  if (!accountStatus) {
    return [];
  }

  const reasons: AccountUnavailableReason[] = [];

  if (accountStatus.userStatus === UserStatus.BLOCKED) {
    reasons.push(AccountUnavailableReason.USER_BLOCKED);
  }

  const jobChargeLimit = accountStatus.jobChargeLimit ? moneyToNumber(accountStatus.jobChargeLimit) : undefined;
  const usedJobCharge = accountStatus.usedJobCharge ? moneyToNumber(accountStatus.usedJobCharge) : undefined;
  if (jobChargeLimit !== undefined && usedJobCharge !== undefined) {
    if (usedJobCharge >= jobChargeLimit) {
      reasons.push(AccountUnavailableReason.USER_QUOTA_EXCEEDED);
    }
  }

  //AccountState.ACCOUNT_FROZEN这个状态目前还未使用
  // if (accountStatus.accountState === AccountState.ACCOUNT_FROZEN) {
  //   reasons.push(AccountUnavailableReason.ACCOUNT_FROZEN);
  // }

  if (accountStatus.isInWhitelist) {
    return reasons;
  }

  if (accountStatus.accountState === AccountState.ACCOUNT_BLOCKED_BY_ADMIN) {
    reasons.push(AccountUnavailableReason.ACCOUNT_BLOCKED);
  }

  const balance = accountStatus.balance ? moneyToNumber(accountStatus.balance) : undefined;
  const blockThresholdAmount = accountStatus.blockThresholdAmount
    ? moneyToNumber(accountStatus.blockThresholdAmount)
    : undefined;
  if (balance !== undefined && blockThresholdAmount !== undefined) {
    if (balance <= blockThresholdAmount) {
      reasons.push(AccountUnavailableReason.ACCOUNT_DEBT);
    }
  }

  return reasons;
};

export const staticConfigServiceServer = plugin((server) => {
  return server.addService<ConfigServiceServer>(ConfigServiceService, {
    getClusterConfig: async ({ request, logger }) => {
      const { cluster } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.config, "getClusterConfig", {}),
      );

      return [reply];
    },

    getAvailablePartitionsForCluster: async ({ request, logger }) => {
      const { cluster, accountName, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      let availablePartitions: Partition[];
      try {
        const resp = await callOnOne(
          cluster,
          logger,
          async (client) =>
            await asyncClientCall(client.config, "getAvailablePartitions", {
              accountName,
              userId,
            }),
        );
        availablePartitions = resp.partitions;
      } catch (error) {
        logger.error(
          "Error occured when query the available partitions of %s in %s. Error %o",
          userId,
          accountName,
          error,
        );
        availablePartitions = [];
      }

      return [{ partitions: availablePartitions }];
    },

    getClusterConfigFiles: async ({ logger }) => {
      const clusterConfigs = getClusterConfigs(undefined, logger, ["hpc"]);
      const currentConfigClusterIds = Object.keys(clusterConfigs);
      if (currentConfigClusterIds.length === 0) {
        throw new ServiceError({
          code: status.INTERNAL,
          details: "Unable to find cluster configuration files. Please contact the system administrator.",
          metadata: scowErrorMetadata(NO_CLUSTERS),
        });
      }

      const clusterConfigsProto = convertClusterConfigsToServerProtoType(clusterConfigs);

      return [{ clusterConfigs: clusterConfigsProto }];
    },

    getApiVersion: async () => {
      const version = await JSON.parse(
        readFileSync(join(__dirname, "../../node_modules/@scow/protos/package.json"), "utf-8"),
      ).version;

      const [major, minor, patch] = version.split(".").map(Number);

      return [{ major, minor, patch }];
    },

    getClusterNodesInfo: async ({ request, logger }) => {
      const { nodeNames, cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterNodesInfo", {
          nodeNames: nodeNames || [],
        });
      });
      return [{ nodes: reply.nodes }];
    },
  });
});

export const runtimeConfigServiceServer = plugin((server) => {
  return server.addService<runTimeConfigServiceServer>(runTimeConfigServiceService, {
    getClusterInfo: async ({ request, logger }) => {
      const { cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterInfo", request);
      });

      return [reply];
    },

    getSummaryClusterInfo: async ({ request, logger }) => {
      const { accountNames, cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getSummaryClusterInfo", {
          accountNames: accountNames || [],
        });
      });

      return [reply];
    },

    /**
     * Deprecated Notice
     * This API function getClusterNodesInfo has been deprecated.
     * Use the new COMMON API function getClusterNodesInfo from ConfigServiceService from protos/common/config instead.
     * @deprecated
     */
    getClusterNodesInfo: async ({ request, logger }) => {
      const { nodeNames, cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterNodesInfo", {
          nodeNames: nodeNames || [],
        });
      });
      return [{ nodes: reply.nodes }];
    },

    /**
     * 获取用户账户集群映射及账户不可用原因
     */
    getAccountClustersWithUnavailableReasons: async ({ request, logger }) => {
      const { userId } = request;

      const activatedClusters = await libGetCurrentActivatedClusters(
        logger,
        configClusters,
        config.MIS_SERVER_URL,
        commonConfig.scowApi.auth.token,
      );
      const currentClusterIds = Object.keys(activatedClusters).filter((clusterId) =>
        Boolean(configClusters[clusterId]),
      );

      if (currentClusterIds.length === 0) {
        return [{ accountClusters: [] }];
      }

      const userInfo = await libGetUserInfo(logger, userId, config.MIS_SERVER_URL, commonConfig.scowApi.auth.token);
      const tenantName = userInfo?.tenantName;
      const accounts = userInfo
        ? (userInfo.affiliations ?? [])
            .filter((affiliation) => affiliation.accountState !== AccountState.ACCOUNT_DELETED)
            .map((affiliation) => affiliation.accountName)
        : undefined;

      if (accounts?.length === 0) {
        return [{ accountClusters: [] }];
      }

      const accountStatuses =
        tenantName && accounts
          ? (
              await asyncClientCall(
                getClientFn(config.MIS_SERVER_URL, commonConfig.scowApi.auth.token)(UserServiceClient),
                "getUserStatus",
                {
                  userId,
                  tenantName,
                  accountNames: accounts,
                },
              )
            ).accountStatuses
          : {};

      const convertAccountClustersToGrpc = (accountClusters: Record<string, string[]>) => {
        const accountNames = accounts ?? Object.keys(accountClusters);
        return accountNames.map((account) => {
          const unavailableReasons = getAccountUnavailableReasons(accountStatuses[account]);
          return {
            accountName: account,
            clusters: accountClusters[account] ?? [],
            available: unavailableReasons.length === 0,
            unavailableReasons,
          };
        });
      };

      const currentClusterSet = new Set(currentClusterIds);
      const accountClusters = Object.fromEntries(
        await Promise.all(
          (accounts ?? []).map(async (accountName) => {
            const clusterIds = await getUserAccountsClusterIds(commonConfig.scowResource, [accountName], tenantName);
            return [
              accountName,
              Array.from(new Set(clusterIds)).filter((clusterId) => currentClusterSet.has(clusterId)),
            ] as const;
          }),
        ),
      ) as Record<string, string[]>;

      return [{ accountClusters: convertAccountClustersToGrpc(accountClusters) }];
    },
  });
});
