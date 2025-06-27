import { ConnectError } from "@connectrpc/connect";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { getLoginNode } from "@scow/config/build/cluster";
import { testRootUserSshLogin } from "@scow/lib-ssh";
import { NodeInfo_NodeState, nodeInfo_NodeStateFromJSON } from "@scow/protos/build/common/config";
import { ClusterRuntimeInfo_LastActivationOperation, ConfigServiceServer,
  ConfigServiceService, MigrateNodeInfo_MigratableCluster, NodeStatus } from "@scow/protos/build/server/config";
import { ApiVersion } from "@scow/utils/build/version";
import { getActivatedClusters, getClustersRuntimeInfo } from "src/bl/clustersUtils";
import { configClusters } from "src/config/clusters";
import { rootKeyPair } from "src/config/env";
import { Cluster, ClusterActivationStatus } from "src/entities/Cluster";
import { getUniqueMigrationGroups, handleValidationErrors,NodeClusterStatus,
  NodeClusterStatusWithPartitions, performClusterChecks
  ,validateMigratableClustersConfig } from "src/utils/migrateNode";
import { getScowdClient, mapConnectRpcStatusToGrpc } from "src/utils/scowd";

export const misConfigServiceServer = plugin((server) => {
  server.addService<ConfigServiceServer>(ConfigServiceService, {

    /**
     * Deprecated Notice
     * This API function GetAvailablePartitions has been deprecated.
     * Use the new API function GetAvailablePartitionsForCluster instead.
     * @deprecated
     */
    getAvailablePartitions: async ({ request, em, logger }) => {

      const { accountName, userId } = request;
      const currentActivatedClusters = await getActivatedClusters(em, logger).catch();
      const reply = await server.ext.clusters.callOnAll(
        currentActivatedClusters,
        logger,
        async (client) => await asyncClientCall(client.config, "getAvailablePartitions", {
          accountName, userId,
        }),
      );

      const wrappedResult = reply.map((x) => {
        return { cluster: x.cluster, partitions: x.result.partitions };
      });

      return [{ clusterPartitions: wrappedResult } ];
    },


    /**
     * @deprecated Use the new API function GetAvailablePartitionsForCluster from ./config/configServiceServer instead.
     */
    getAvailablePartitionsForCluster: async ({ request, logger }) => {

      const { cluster, accountName, userId } = request;
      // do not need check cluster's activation
      const reply = await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.config, "getAvailablePartitions", {
          accountName, userId,
        }),
      );

      return [reply];
    },

    getClustersRuntimeInfo: async ({ em, logger }) => {

      const reply = await getClustersRuntimeInfo(em, logger);

      return [{ results: reply }];
    },

    activateCluster: async ({ request, em, logger }) => {
      const { clusterId, operatorId } = request;

      return await em.transactional(async (em) => {
        const cluster = await em.findOne(Cluster, { clusterId });

        if (!cluster) {
          throw {
            code: status.NOT_FOUND, message: `Cluster（ Cluster ID: ${clusterId}） is not found`,
          } as ServiceError;
        }

        // check current scheduler adapter connection state
        // do not need check cluster's activation
        await server.ext.clusters.callOnOne(
          clusterId,
          logger,
          async (client) => await asyncClientCall(client.config, "getClusterConfig", {}),
        ).catch((e) => {
          logger.info("Cluster Connection Error ( Cluster ID : %s , Details: %s ) .", cluster, e);
          throw {
            code: status.FAILED_PRECONDITION,
            message: `Activate cluster failed, Cluster（ Cluster ID: ${clusterId}） is currently unreachable.`,
          } as ServiceError;
        });

        // when the cluster has already been activated
        if (cluster.activationStatus === ClusterActivationStatus.ACTIVATED) {
          logger.info("Cluster (Cluster ID: %s) has already been activated",
            clusterId,
          );
          return [{ executed: false }];
        }

        // check root user ssh login in the target cluster
        const targetClusterLoginNodes = configClusters[clusterId].loginNodes;

        const loginNode = getLoginNode(targetClusterLoginNodes[0]);
        const address = loginNode.address;
        const node = loginNode.name;

        if (configClusters[clusterId].scowd?.enabled) {
          const client = getScowdClient(clusterId);

          try {
            logger.info("Checking whether scowd is running normally on cluster %s", clusterId);

            await client.system.checkHealth({});
            logger.info("Scowd runs normally on the login node %s of cluster %s.", node, clusterId);
          } catch (err) {
            logger.info("Scowd is not functioning properly on cluster %s. err: %o",
              clusterId, err);

            if (err instanceof ConnectError) {
              throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
            }
            throw err;
          }

        } else {
          logger.info("Checking if root can login to cluster (clusterId: %s) by login node %s",
            clusterId, node);

          const error = await testRootUserSshLogin(address, rootKeyPair, logger);

          if (error) {
            logger.info("Root cannot login to cluster (clusterId: %s) by login node %s. err: %o",
              clusterId, node, error);
            throw {
              code: status.FAILED_PRECONDITION,
              message: `Activate cluster failed, root login check failed in Cluster（ Cluster ID: ${clusterId}） .`,
            } as ServiceError;
          } else {
            logger.info("Root can login to cluster (clusterId: %s) by login node %s", clusterId, node);
          }
        }

        cluster.activationStatus = ClusterActivationStatus.ACTIVATED;

        // save operator userId in lastActivationOperation
        const lastActivationOperationMap: ClusterRuntimeInfo_LastActivationOperation = {};

        lastActivationOperationMap.operatorId = operatorId;
        cluster.lastActivationOperation = lastActivationOperationMap;

        await em.persistAndFlush(cluster);

        logger.info("Cluster (Cluster ID: %s) is successfully activated by user (User Id: %s)",
          clusterId,
          operatorId,
        );

        return [{ executed: true }];

      });

    },

    deactivateCluster: async ({ request, em, logger }) => {
      const { clusterId, operatorId, deactivationComment } = request;

      const cluster = await em.findOne(Cluster, { clusterId });

      if (!cluster) {
        throw {
          code: status.NOT_FOUND, message: `Cluster（ Cluster ID: ${clusterId}） is not found`,
        } as ServiceError;
      }

      if (cluster.activationStatus === ClusterActivationStatus.DEACTIVATED) {

        logger.info("Cluster (Cluster ID: %s) has already been deactivated");

        return [{ executed: false }];
      }

      cluster.activationStatus = ClusterActivationStatus.DEACTIVATED;

      // save operator userId and deactivation in lastActivationOperation
      const lastActivationOperationMap: ClusterRuntimeInfo_LastActivationOperation = {};
      lastActivationOperationMap.operatorId = operatorId;

      if (deactivationComment) {
        lastActivationOperationMap.deactivationComment = deactivationComment;
      }
      cluster.lastActivationOperation = lastActivationOperationMap;


      await em.persistAndFlush(cluster);

      logger.info("Cluster (Cluster ID: %s) is successfully deactivated by user (User Id: %s) with comment %s",
        clusterId,
        operatorId,
        deactivationComment,
      );

      return [{ executed: true }];

    },

    // 获取迁移节点信息
    getClusterMigrateNodesInfo: async ({ request, logger }) => {

      const start = Date.now();

      const { nodeNames, cluster } = request;

      // 当前适配器和业务需求nodeNames仅查询单个节点时准确，后续完善批量查询
      if (nodeNames.length > 1) {
        throw {
          code: status.INVALID_ARGUMENT,
          message: "Currently only supports nodeNames with length 0 or 1.",
        } as ServiceError;
      }

      // 1. 配置校验是否正确
      const migratableClusterGroups = validateMigratableClustersConfig();

      // 2. 从配置文件获取该集群节点可能迁移的目标集群
      const uniqueGroups = getUniqueMigrationGroups(migratableClusterGroups, cluster);

      logger.info(`Loaded ${uniqueGroups.length} eligible migration targets for cluster ${uniqueGroups.join(", ")}`);

      // 3. 判断各适配器接口版本
      const minRequiredApiVersion: ApiVersion = { major: 1, minor: 9, patch: 0 };

      const clusterArr = [...uniqueGroups, cluster];

      // 检查集群状态和版本
      const { clusterErrors, versionErrors } = await performClusterChecks(
        {
          clusters: clusterArr,
          minVersion: { major: 1, minor: 9, patch: 0 },
          operationName: "getClusterMigrateNodesInfo",
        },
        logger,
        server,
      );

      // 整理前述报错
      handleValidationErrors({
        clusterErrors,
        versionErrors,
        minVersion: minRequiredApiVersion,
        logger,
      });

      // 4. 获取当前集群的所有节点
      const { nodes: originNodes } = await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => {
          return await asyncClientCall(client.config, "getClusterNodesInfo", {
            nodeNames: nodeNames || [],
          });
        },
      ).catch((e) => {

        const message = `get node ${nodeNames.join(",")} of cluster ${cluster} failed`;

        logger.error(message);

        const errDetailsArr = e.details?.split("Error: 5 NOT_FOUND");

        if (errDetailsArr && errDetailsArr.length === 2) {

          const message = errDetailsArr[1].split(": ")[1];

          if (message) {
            return { nodes: []};
          }
        }
        logger.error(JSON.stringify(e));

        throw {
          code: status.UNKNOWN,
          message,
        } as ServiceError;
      });

      logger.info(`get nodes from cluster ${cluster} success`);

      // 在步骤5之前增加节点状态聚合Map, 记录各节点在其可能存在的集群中的状态
      const nodeClusterStatusMap = new Map<string, NodeClusterStatusWithPartitions[]>();

      // 5. 获取各可能迁移的目标集群的所有节点列表
      const nodeClusterErrorArr: string[] = [];

      await Promise.allSettled(
        uniqueGroups.map(async (targetCluster) => {
          const { nodes } = await server.ext.clusters.callOnOne(
            targetCluster,
            logger,
            async (client) => {
              return await asyncClientCall(client.config, "getClusterNodesInfo", {
                nodeNames: nodeNames || [],
              });
            },
          ).catch((e) => {

            const message = `get node ${nodeNames.join(",")} of cluster ${targetCluster} failed`;

            logger.error(message, e);

            const errDetailsArr = e.details?.split("Error: 5 NOT_FOUND");

            if (!errDetailsArr || errDetailsArr.length === 1) { // 非找不到节点，是其他错误，要抛出

              nodeClusterErrorArr.push(targetCluster);

              logger.error(JSON.stringify(e));

              throw {
                code: status.UNKNOWN,
              } as ServiceError;
            }

            // 找不到节点，忽略
            throw {
              code: status.NOT_FOUND,
            } as ServiceError;

          });

          logger.info("%s 集群中的节点 %o", targetCluster, nodes);

          // 构建节点的各集群状态映射
          nodes.forEach((node) => {
            const key = node.nodeName;
            const nodeValue = nodeClusterStatusMap.get(key) || [];
            nodeValue.push({
              cluster: targetCluster,
              partitions: node.partitions,
              state: node.state,
              removable: node.removable,
            });

            nodeClusterStatusMap.set(key, nodeValue);
          });
          return nodes;
        }),
      );

      if (nodeClusterErrorArr.length) {

        const message = `get cluster ${nodeClusterErrorArr.join(", ")} NodesInfo failed`;

        throw {
          code: status.UNKNOWN,
          message,
        } as ServiceError;
      }

      // 6. 首先筛选出当前集群节点中存在于其他集群的节点，并过滤其他集群已上线的节点
      const filterOtherClusterUpNodes = originNodes.filter((node) => {
        // 全局状态检查（a. 过滤其他集群已上线的节点）
        const allClustersStatus = nodeClusterStatusMap.get(node.nodeName) || [];

        return allClustersStatus.length && !allClustersStatus.some((node) =>
          (node.state !== NodeInfo_NodeState.NOT_AVAILABLE || !node.removable),
        );
      });

      logger.info("get nodes statusType from relative cluster");
      // 7. 获得在当前集群上线以及在所有集群都没上线的节点，并构建各节点的NodeStatus和可迁移集群与各集群可迁移到的分区
      const migrateNodes = filterOtherClusterUpNodes.map((node) => {

        // 状态判断逻辑（新增statusType字段）
        let statusType: NodeStatus;

        if (nodeInfo_NodeStateFromJSON(node.state) !== NodeInfo_NodeState.NOT_AVAILABLE) { // 该节点在该集群线上
          statusType = node.removable ?
            NodeStatus.ACTIVE_MIGRATABLE : // b. 节点在该集群上，可迁移
            NodeStatus.OCCUPIED_BY_JOBS; // c. 节点在该集群上，不可迁移
        } else { // 该节点不在该集群线上或drain了
          const allClustersStatus = nodeClusterStatusMap.get(node.nodeName) || [];

          const allOffline = allClustersStatus.every((s) =>
            s.state === NodeInfo_NodeState.NOT_AVAILABLE && s.removable,
          );

          if (allOffline && node.removable) { // d. 该节点未在任何集群上线
            statusType = NodeStatus.OFFLINE_RECOVERABLE;
          } else {
            if (!node.removable) {
              statusType = NodeStatus.OCCUPIED_BY_JOBS; // e. 该节点在该集群上，drain状态
            } else {
              logger.error("Node migration status unknown. ", JSON.stringify(node));
              throw {
                code: status.UNKNOWN,
                message: "Node migration status unknown." } as ServiceError;
            }
          }
        }

        return { ...node , nodeStatus: statusType, migratableClusterList: nodeClusterStatusMap.get(node.nodeName) };

      });

      const results = migrateNodes
        .map((node) => ({
          ...node,
          migratableClusterList: node.migratableClusterList!.map((cluster) => ({
            cluster: cluster.cluster,
            partitions: cluster.partitions,
          })) as MigrateNodeInfo_MigratableCluster[], // 使用生成的类型
        }));

      const durationMs = Date.now() - start;

      logger.info(`Processed get Cluster MigrateNodesInfo in ${durationMs}ms`); // 生产上线后，据此作为节点筛选输入框的策略依据

      // 返回可以迁移集群的节点列表
      return [{ nodes: results }];

    },

    migrateNode: async ({ request, logger }) => {

      // 1. 配置校验是否正确
      const migratableClusterGroups = validateMigratableClustersConfig();

      // originCluster未定义时为节点上线，有定义为节点迁移
      const { nodeName, originCluster, destinationCluster } = request;

      // 2. 从配置文件获取要上线的集群节点可能迁移的目标集群
      const uniqueGroups = getUniqueMigrationGroups(migratableClusterGroups, destinationCluster);

      logger.info(`Loaded ${uniqueGroups.length} eligible migration targets for cluster ${uniqueGroups.join(", ")}`);

      // 3. 判断涉及集群的适配器接口版本以及适配器是否存在
      const minRequiredApiVersion: ApiVersion = { major: 1, minor: 9, patch: 0 };

      const clusterArr = [destinationCluster, ...uniqueGroups]; // 需要校验的集群列表

      if (originCluster) {
        clusterArr.push(originCluster);
      }

      // 检查集群状态和版本
      const { clusterErrors, versionErrors } = await performClusterChecks(
        {
          clusters: clusterArr,
          minVersion: { major: 1, minor: 9, patch: 0 },
          operationName: "migrateNode",
        },
        logger,
        server,
      );

      // 整理前述报错
      handleValidationErrors({
        clusterErrors,
        versionErrors,
        minVersion: minRequiredApiVersion,
        logger,
      });

      // 4. 节点下线
      if (originCluster) {

        logger.info(`remove node ${nodeName} from cluster ${originCluster}`);

        await server.ext.clusters.callOnOne(
          originCluster,
          logger,
          async (client) => {
            return await asyncClientCall(client.node, "removeNodeFromCluster", {
              nodeName,
            });
          },
        ).catch((e) => {

          const message = `remove node from cluster ${originCluster} failed`;

          logger.error(message, e);

          throw {
            code: status.INTERNAL,
            message,
          } as ServiceError;
        });

        logger.info(`remove node ${nodeName} from cluster ${originCluster} success`);

      }

      logger.info(`add node ${nodeName} to cluster ${destinationCluster}`);

      // 节点状态聚合数组, 记录节点在其可能存在的集群中的状态
      const nodeClusterStatusArr: NodeClusterStatus[] = [];

      // 5. 获取各相关集群与目标集群的该节点状态数组

      const nodeClusterErrorArr: string[] = [];

      await Promise.allSettled(
        [destinationCluster, ...uniqueGroups].map(async (targetCluster) => {
          const { nodes } = await server.ext.clusters.callOnOne(
            targetCluster,
            logger,
            async (client) => {
              return await asyncClientCall(client.config, "getClusterNodesInfo", {
                nodeNames: [ nodeName ],
              });
            },
          ).catch((e) => {

            logger.error(`get ${targetCluster} ${nodeName} NodesInfo failed`, e);

            const errDetailsArr = e.details.split("Error: 5 NOT_FOUND");

            if (errDetailsArr.length === 1) { // 非找不到节点，是其他错误
              nodeClusterErrorArr.push(targetCluster);
            }

            throw {
              code: status.NOT_FOUND,
            } as ServiceError;

          });
          // 构建节点的各集群状态映射
          nodes.forEach((node) => {

            nodeClusterStatusArr.push({
              cluster: targetCluster,
              state: node.state,
              removable: node.removable,
            });

          });
          return nodes;
        }),
      );

      if (nodeClusterErrorArr.length) {

        const message = `get ${nodeClusterErrorArr.join(", ")} NodesInfo failed`;

        throw {
          code: status.INTERNAL,
          message,
        } as ServiceError;
      }


      // 6. 若该节点已在某集群上线则报错
      logger.info("nodeClusterStatusArr %o", nodeClusterStatusArr);
      const nodeActiveArr = nodeClusterStatusArr.filter((node) =>
        node.state !== NodeInfo_NodeState.NOT_AVAILABLE || !node.removable,
      );

      if (nodeActiveArr.length) {
        const message =
        `node ${nodeName} is already active on cluster ${nodeActiveArr.map((item) => item.cluster).join(", ")}`;

        logger.error(message);

        throw {
          code: status.FAILED_PRECONDITION,
          message,
        } as ServiceError;
      }

      // 7. 节点在目标集群上线
      await server.ext.clusters.callOnOne(
        destinationCluster,
        logger,
        async (client) => {

          return await asyncClientCall(client.node, "addNodeToCluster", {
            nodeName,
          });
        },
      ).catch((e) => {

        const message = `add node to cluster ${originCluster} failed`;

        logger.error(message, e);

        throw {
          code: status.INTERNAL,
          message,
        } as ServiceError;
      });

      logger.info(`add node ${nodeName} to cluster ${destinationCluster} success`);

      return [{}];
    },

  });
});
