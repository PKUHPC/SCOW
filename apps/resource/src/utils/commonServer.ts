import { Loaded } from "@mikro-orm/core";
import { PartitionNames } from "@scow/scow-resource-protos/generated/resource/partition";
import { AccountClusterRule } from "src/server/entities/AccountClusterRule";
import { AccountPartitionRule } from "src/server/entities/AccountPartitionRule";
import { TenantClusterRule } from "src/server/entities/TenantClusterRule";
import { TenantPartitionRule } from "src/server/entities/TenantPartitionRule";
import { callHook } from "src/server/hookClient";
import { getAvailablePartitionsResult } from "src/server/utils/clusterPartitions";

import { forkEntityManager } from "./getOrm";
import { logger } from "./logger";
import { USE_MOCK } from "./processEnv";

/**
 * 获取账户列表的已授权集群
 * @param accountNames
 * @param tenantName
 * @returns
 */
export async function getAccountsAssignedClusters(
  accountNames: string[],
  tenantName: string,
  currentClusterIds: string[],
):
  Promise<string[]> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return ["hpc01"];
  }

  const em = await forkEntityManager();
  const results = await em.find(AccountClusterRule, {
    tenantName,
    accountName: { $in: accountNames },
    clusterId: { $in: currentClusterIds },
  });

  const clusterIds = results.map((item) => (item.clusterId));
  const uniqueClusterIds = clusterIds.reduce<string[]>((acc, id) => {
    if (!acc.includes(id)) {
      acc.push(id);
    }
    return acc;
  }, []);
  return uniqueClusterIds;
}

/**
 * 获取账户的某集群下的已授权分区
 * @param accountName
 * @param tenantName
 * @param clusterId
 * @returns
 */
export async function getAccountAssignedPartitionsInCluster(
  accountName: string,
  tenantName: string,
  clusterId: string,
  currentClusterPartitions: Record<string, string[]>,
):
  Promise<string[]> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return ["compute1", "compute2"];
  }

  const em = await forkEntityManager();
  const found = await em.find(AccountPartitionRule,
    {
      accountName,
      tenantName,
      clusterId,
    });

  return found.filter((item) => currentClusterPartitions[clusterId]?.includes(item.partition))
    .map((item) => item.partition);
}

/**
 * 批量获取账户的某集群下的已授权分区
 * @param accountsWithTenants
 * @param clusterId
 * @returns
 */
export async function getAccountsAssignedPartitionsInCluster(
  accountsWithTenants: { accountName: string, tenantName: string }[],
  clusterId: string,
  currentClusterPartitions: Record<string, string[]>,
):
  Promise<Record<string, PartitionNames>> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return {
      "accountA": { partitionNames: ["compute1", "compute2"]},
      "accountB": { partitionNames: ["compute1", "compute2"]},
    };
  }

  const conditions = accountsWithTenants.map(({ accountName, tenantName }) => {
    return {
      accountName,
      tenantName,
      clusterId,
    };
  });

  const em = await forkEntityManager();
  const found = await em.find(AccountPartitionRule, { $or: conditions });
  const filteredResult = getAvailablePartitionsResult(currentClusterPartitions, found);

  // 首先为所有账户创建空记录
  const result: Record<string, PartitionNames> = {};
  accountsWithTenants.forEach(({ accountName }) => {
    result[accountName] = {
      partitionNames: [],
      _set: new Set<string>(),
    } as PartitionNames & { _set: Set<string> };
  });

  // 然后填充找到的分区
  filteredResult.forEach((cur) => {
    const key = cur.accountName;
    const item = result[key] as PartitionNames & { _set: Set<string> };

    if (!item._set.has(cur.partition)) {
      item._set.add(cur.partition);
      item.partitionNames.push(cur.partition);
    }
  });

  // 删除临时使用的Set
  Object.values(result).forEach((item) => {
    delete (item as any)._set;
  });

  return result;
}


/**
 * 获取账户集群下的已授权分区
 * @param accountNames
 * @param tenantName
 * @returns
 */
export async function getAccountsAssignedClusterPartitions(
  accountNames: string[], tenantName: string, currentClusterPartitions: Record<string, string[]>):
  Promise<Record<string, PartitionNames>> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return {
      "hpc01": { partitionNames: ["compute1", "compute2"]},
    };
  }

  const currentClusterIds = Object.keys(currentClusterPartitions);

  const em = await forkEntityManager();

  // 获取集群
  const foundClusters = await em.find(AccountClusterRule, {
    accountName: { $in: accountNames },
    tenantName,
    clusterId: { $in: currentClusterIds },
  });
  // 获取分区
  const foundPartitions = await em.find(AccountPartitionRule, {
    accountName: { $in: accountNames },
    tenantName,
    clusterId: { $in: currentClusterIds },
  });
  const filteredPartitionsResult = getAvailablePartitionsResult(currentClusterPartitions, foundPartitions);

  const results = mapToClusterPartitions(foundClusters, filteredPartitionsResult);

  return results;
}

/**
 * 获取租户已授权的集群和分区
 * @param tenantName
 * @returns
 */
export async function getTenantAssignedClusterPartitions(
  tenantName: string, currentClusterPartitions: Record<string, string[]>):
  Promise<Record<string, PartitionNames>> {

  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return {
      "hpc01": { partitionNames: ["compute1", "compute2"]},
    };
  }

  const currentClusterIds = Object.keys(currentClusterPartitions);

  const em = await forkEntityManager();

  const foundClusters = await em.find(TenantClusterRule, {
    tenantName,
    clusterId: { $in: currentClusterIds },
  });
  const foundPartitions = await em.find(TenantPartitionRule, {
    tenantName,
    clusterId: { $in: currentClusterIds },
  });
  const filteredPartitionsResult = getAvailablePartitionsResult(currentClusterPartitions, foundPartitions);
  const results = mapToClusterPartitions(foundClusters, filteredPartitionsResult);

  return results;
}

/**
 * 给账户写入默认授权的集群授权信息和分区信息
 * @param accountName
 * @param tenantName
 */
export async function assignCreatedAccount(
  accountName: string,
  tenantName: string,
  currentClusterPartitions: Record<string, string[]>,
):
  Promise<boolean> {

  const em = await forkEntityManager();
  let foundDefaultClusterIds: string[] = [];

  await em.transactional(async (em) => {
    // 同名租户账户理论上无法重复创建
    // 确认同名租户下账户是否已存在授权集群和分区，如果存在直接删除重新写入
    const existedClusters = await em.find(AccountClusterRule, { accountName, tenantName });
    if (existedClusters.length > 0) {
      const existedClusterIds = existedClusters.map((item) => (item.clusterId)).join(",");
      logger.info(`Account ${accountName} in tenant ${tenantName} already assigned to clusters: ${existedClusterIds}.`
      + "They will be removed during re-assign.");
      await em.removeAndFlush(existedClusters);
    }
    const existedPartitions = await em.find(AccountPartitionRule, { accountName, tenantName });
    if (existedPartitions.length > 0) {
      const existedPartitionNames = existedPartitions.map((item) => (item.partition)).join(",");
      logger.info(
        `Account ${accountName} in tenant ${tenantName} already assigned to partitions: ${existedPartitionNames}.`
      + "They will be removed during re-assign.");
      await em.removeAndFlush(existedPartitions);
    }

    const currentClusterIds = Object.keys(currentClusterPartitions);

    // 获取租户下设置的账户默认授权的集群和分区
    const foundDefaultClusters = await em.find(TenantClusterRule,
      { tenantName,
        isAccountDefaultCluster: true,
        clusterId: { $in: currentClusterIds },
      });
    const foundDefaultPartitions = await em.find(TenantPartitionRule, {
      tenantName,
      isAccountDefaultPartition: true,
      clusterId: { $in: currentClusterIds },
    });
    const filteredPartitionsResult = getAvailablePartitionsResult(currentClusterPartitions, foundDefaultPartitions);

    foundDefaultClusterIds = foundDefaultClusters.map((item) => (item.clusterId));
    foundDefaultClusterIds.forEach((clusterId) => {
      const accountCluster = new AccountClusterRule({
        accountName,
        tenantName,
        clusterId,
      });
      em.persist(accountCluster);
    });

    filteredPartitionsResult.forEach((item) => {
      const accountPartition = new AccountPartitionRule({
        accountName,
        tenantName,
        clusterId: item.clusterId,
        partition: item.partition,
      });
      em.persist(accountPartition);
    });

    await em.flush();
  });

  // 通知账户授权集群数据
  await callHook("accountAssignedToClusters",
    { accountName, tenantName, clusterIds: foundDefaultClusterIds }, logger);

  return true;
}

/**
 * 提交作业/交互式应用时 选择集群后过滤已授权账户
 * @param clusterId
 * @param tenantName
 */
export async function getClusterAssignedAccountsData(clusterId: string, tenantName: string):
Promise<string[]> {
  const em = await forkEntityManager();
  const found = await em.find(AccountClusterRule, { clusterId, tenantName });

  return found.map((item) => item.accountName);
}


function mapToClusterPartitions(
  clustersInfo: Loaded<AccountClusterRule>[] | Loaded<TenantClusterRule>[],
  partitionsInfo: Loaded<AccountPartitionRule>[] | Loaded<TenantPartitionRule>[],
): Record<string, PartitionNames> {

  const results: Record<string, PartitionNames> = {};

  // 遍历已获取的集群信息，将它们添加到结果集中
  clustersInfo.forEach((cluster) => {
    results[cluster.clusterId] = { partitionNames: []};
  });

  // 遍历已获取的分区信息，根据集群名将分区名称添加到结果集中
  partitionsInfo.forEach((partition) => {
    if (results[partition.clusterId]) {
      results[partition.clusterId].partitionNames.push(partition.partition);
    }
  });

  return results;
}



/**
 * 提交作业/交互式应用时 检查账户在集群或分区下的授权情况
  * @param partitionName 如果不存在只检查账户集群的授权，如果存在检查账户在集群分区下的授权
 */
export async function checkAccountInClusterPartition(accountName: string, clusterId: string, partitionName?: string):
Promise<boolean> {
  const em = await forkEntityManager();

  if (partitionName) {
    // 检查账户在集群分区下的授权
    const found = await em.findOne(AccountPartitionRule,
      { accountName, clusterId, partition: partitionName });
    return found !== null;
  }
  const found = await em.find(AccountClusterRule, { clusterId, accountName });
  return found !== null;
}
