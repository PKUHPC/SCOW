import { ConnectRouter } from "@connectrpc/connect";
import { checkScowApiToken } from "@scow/lib-server";
import { ClusterPartitionService } from "@scow/scow-resource-protos/generated/resource/partition_connect";
import {
  AssignAccountOnCreateRequest,
  AssignAccountOnCreateResponse,
  GetAccountAssignedPartitionsForClusterRequest,
  GetAccountAssignedPartitionsForClusterResponse,
  GetAccountsAssignedClusterIdsRequest,
  GetAccountsAssignedClusterIdsResponse,
  GetAccountsAssignedClustersAndPartitionsRequest,
  GetAccountsAssignedClustersAndPartitionsResponse,
  GetAccountsAssignedPartitionsForClusterRequest,
  GetAccountsAssignedPartitionsForClusterResponse,
  GetClusterAssignedAccountsRequest,
  GetClusterAssignedAccountsResponse,
  GetTenantAssignedClustersAndPartitionsRequest,
  GetTenantAssignedClustersAndPartitionsResponse,
  IsAccountAuthorizedInClusterPartitionRequest,
  IsAccountAuthorizedInClusterPartitionResponse,
} from "@scow/scow-resource-protos/generated/resource/partition_pb";
import { commonConfig } from "src/server/config/common";
import { getScowActivatedClusterIds, getScowActivatedClusterPartitions } from "src/server/mis-server/cluster";
import { checkClusterIdAvailable, checkClusterPartitionAvailable } from "src/utils/auth/utils";
import { assignCreatedAccount, checkAccountInClusterPartition, getAccountAssignedPartitionsInCluster,
  getAccountsAssignedClusterPartitions,
  getAccountsAssignedClusters,
  getAccountsAssignedPartitionsInCluster,
  getClusterAssignedAccountsData,
  getTenantAssignedClusterPartitions } from "src/utils/commonServer";
import { logger } from "src/utils/logger";


export default (router: ConnectRouter) => {
  router.service(ClusterPartitionService, {

    /**
     * 获取账户数组的已授权集群
     * 主要用于判断登录用户的关联账户的可用集群
     * 如果当前没有可用集群，则返回空
     * @param request
     * @returns
     */
    async getAccountsAssignedClusterIds(request: GetAccountsAssignedClusterIdsRequest, ctx):
    Promise<GetAccountsAssignedClusterIdsResponse> {

      await checkScowApiToken(ctx, commonConfig.scowApi);
      const currentClusterIds = await getScowActivatedClusterIds().catch(() => {
        logger.warn("No available clusters when querying scow-resource.");
        return [];
      });
      const { accountNames, tenantName } = request;
      const data = await getAccountsAssignedClusters(accountNames, tenantName, currentClusterIds);
      return new GetAccountsAssignedClusterIdsResponse({ assignedClusterIds: data });
    },

    /**
     * 获取账户在某集群下已授权的分区
     * 用于集群下对帐户的封锁解封等操作
     * 如果当前没有可用集群，则返回空
     * @param request
     * @returns
     */
    async getAccountAssignedPartitionsForCluster(request: GetAccountAssignedPartitionsForClusterRequest, ctx):
    Promise<GetAccountAssignedPartitionsForClusterResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);
      const { accountName, tenantName, clusterId } = request;
      const currentClusterPartitions = await getScowActivatedClusterPartitions(logger).catch(() => {
        logger.warn("No available cluster partitions when querying scow-resource.");
        return {};
      });
      const data = await getAccountAssignedPartitionsInCluster(
        accountName, tenantName, clusterId, currentClusterPartitions);
      return new GetAccountAssignedPartitionsForClusterResponse({ assignedPartitionNames: data });
    },

    /**
     * 批量获取账户在某集群下已授权的分区
     * 用于账户分区同步等账户的批量操作
     * 防止获取单一账户授权分区时创建大量并发连接
     * 如果当前没有可用集群，则返回空
     * @param request
     * @returns
     */
    async getAccountsAssignedPartitionsForCluster(request: GetAccountsAssignedPartitionsForClusterRequest, ctx):
    Promise<GetAccountsAssignedPartitionsForClusterResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);
      const { accountsWithTenants, clusterId } = request;
      const currentClusterPartitions = await getScowActivatedClusterPartitions(logger)
        .catch(() => {
          logger.warn("No available cluster partitions when querying scow-resource.");
          return {};
        });
      const data = await getAccountsAssignedPartitionsInCluster(
        accountsWithTenants,
        clusterId,
        currentClusterPartitions,
      );
      return new GetAccountsAssignedPartitionsForClusterResponse({ assignedAccountPartitions: data });
    },

    /**
     * 获取账户数组的已授权集群与已授权分区信息
     * 如果当前没有可用集群，则返回空
     * @param request
     * @returns
     */
    async getAccountsAssignedClustersAndPartitions(request: GetAccountsAssignedClustersAndPartitionsRequest, ctx):
    Promise<GetAccountsAssignedClustersAndPartitionsResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);

      const currentClusterPartitions = await getScowActivatedClusterPartitions(logger).catch(() => {
        logger.warn("No available cluster partitions when querying scow-resource.");
        return {};
      });
      const { accountNames, tenantName } = request;
      const data = await getAccountsAssignedClusterPartitions(accountNames, tenantName, currentClusterPartitions);
      return new GetAccountsAssignedClustersAndPartitionsResponse({ assignedClusterPartitions: data });
    },

    /**
     * 获取租户的已授权集群与已授权分区信息
     * 如果当前没有可用集群，则返回空
     * @param request
     * @returns
     */
    async getTenantAssignedClustersAndPartitions(request: GetTenantAssignedClustersAndPartitionsRequest, ctx):
    Promise<GetTenantAssignedClustersAndPartitionsResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);
      const { tenantName } = request;
      const currentClusterPartitions = await getScowActivatedClusterPartitions(logger).catch(() => {
        logger.warn("No available cluster partitions when querying scow-resource.");
        return {};
      });
      const data = await getTenantAssignedClusterPartitions(tenantName, currentClusterPartitions);
      const result = new GetTenantAssignedClustersAndPartitionsResponse({ assignedClusterPartitions: data });
      return result;
    },

    /**
     * 创建账户时写入默认授权集群与默认授权分区
     * 如果当前没有可用集群，则不写入
     * @param request
     * @returns
     */
    async assignAccountOnCreate(request: AssignAccountOnCreateRequest, ctx):
    Promise<AssignAccountOnCreateResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);
      const { accountName, tenantName } = request;
      logger.info("A new account will be created."
         + " Assign account %s in tenant %s with default assigned clusters and partitions.", accountName, tenantName);
      // 获取当前在线集群分区
      const currentClusterPartitions = await getScowActivatedClusterPartitions(logger)
        .catch(() => {
          logger.warn("No available cluster partitions when querying scow-resource.");
          return {};
        });
      const result = await assignCreatedAccount(accountName, tenantName, currentClusterPartitions);
      return new AssignAccountOnCreateResponse({ executed: result });
    },

    /**
     * 提交作业/交互式应用时 选择集群后过滤已授权账户
     * @param request
     * @returns
     */
    async getClusterAssignedAccounts(request: GetClusterAssignedAccountsRequest, ctx):
    Promise<GetClusterAssignedAccountsResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);
      const { clusterId, tenantName } = request;
      await checkClusterIdAvailable(clusterId).catch(() => {
        logger.warn("No available clusters when querying scow-resource.");
        return [];
      });
      const result = await getClusterAssignedAccountsData(clusterId, tenantName);
      return new GetClusterAssignedAccountsResponse({ accountNames: result });
    },

    /**
     * 提交作业/交互式应用时 校验当前账户在 集群 或 集群分区下是否已授权
     * @param request
     * @returns
     */
    async isAccountAuthorizedInClusterPartition(request: IsAccountAuthorizedInClusterPartitionRequest, ctx):
    Promise<IsAccountAuthorizedInClusterPartitionResponse> {
      await checkScowApiToken(ctx, commonConfig.scowApi);
      const { accountName, clusterId, partitionName } = request;

      // 检查 集群 或 集群分区 是否可用
      if (partitionName) {
        await checkClusterPartitionAvailable(clusterId, partitionName, logger);
      } else {
        await checkClusterIdAvailable(clusterId);
      }

      const result = await checkAccountInClusterPartition(accountName, clusterId, partitionName);
      return new IsAccountAuthorizedInClusterPartitionResponse({ isAuthorized: result });
    },

  });
};
