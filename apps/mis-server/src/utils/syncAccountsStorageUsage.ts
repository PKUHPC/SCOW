import { Logger } from "@ddadaal/tsgrpc-server";
import { LockMode, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { buildStorageConfigProto, getExecutableStorageIds } from "@scow/lib-server";
import dayjs from "@scow/lib-server/build/date";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { Account, AccountState } from "src/entities/Account";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { DailyStorageUsage } from "src/entities/DailyStorageUsage";
import { getScowdClient } from "src/utils/scowd";
import {
  getScowdQuotaGroupNameForStorage,
  resolveScowdQuotaGroupNamesBestEffort,
} from "src/utils/scowdQuotaGroupName";
import {
  executeStorageOperationWithFailoverWithContext,
  resolveStorageExecutionTargetWithContext,
} from "src/utils/storageExecutionTarget";

export interface SyncAccountStorageUsageError {
  storageId: string;
  accountName: string;
}

/**
 * 同步账户存储使用量。OceanStor Pacific 使用原始 LDAP 组名，不参与纯数字组名 gid 转换；
 * 同一批次涉及其他文件系统时，数字组名才会先通过 LDAP 解析。
 */
export async function syncAccountsStorageUsage(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  storageId?: string,
  tenant?: string,
): Promise<SyncAccountStorageUsageError[]> {
  logger.info(
    "Starting to sync account storage usage with params: storageId=%s, tenant=%s",
    storageId,
    tenant,
  );
  const errors: SyncAccountStorageUsageError[] = [];

  try {
    const clusterConfigs = getClusterConfigs(undefined, logger);
    const currentActivatedClusters = await getActivatedClusters(em, logger);
    const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
    const executableStorageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);
    const storageIds = storageId ? [storageId] : executableStorageIds;

    if (storageIds.length === 0) {
      logger.info(
        { requestedStorageId: storageId, activatedClusterIds: [...activatedClusterIds] },
        "No quota-enabled storage is available on activated clusters; skipping account storage usage sync",
      );
      return [];
    }

    const accounts = await em.find(
      Account,
      {
        state: { $ne: AccountState.DELETED },
        ...(tenant ? { tenant: { name: tenant } } : {}),
      },
      { fields: ["accountName", "accountGroupName"] },
    );

    if (accounts.length === 0) {
      return [];
    }

    const storageExecutionContext = { clusterConfigs, activatedClusterIds };
    const executionTargets = storageIds.map((currentStorageId) => ({
      currentStorageId,
      ...resolveStorageExecutionTargetWithContext(currentStorageId, storageExecutionContext, logger),
    }));
    logger.info("Starting account storage usage sync", { storageIds, tenant, accountCount: accounts.length });

    for (const { currentStorageId, executionCluster, executionPath, executionStorage } of executionTargets) {
      // 保持原有按存储尽力而为语义：Pacific 不解析 gid；其他文件系统解析失败只跳过当前存储的数字账户。
      const resolution = await resolveScowdQuotaGroupNamesBestEffort(
        accounts,
        (account) => account.accountGroupName!,
        [{
          ...executionStorage,
          storageId: currentStorageId,
          clusterId: executionCluster,
        }],
        logger,
      );
      const accountsToSync = resolution.items;
      const accountNames = accountsToSync.map((account) => account.accountName);
      const { groupNameMap } = resolution;
      errors.push(...resolution.failedItems.map((account) => ({
        storageId: currentStorageId,
        accountName: account.accountName,
      })));

      // 每批同步一部分账户，避免单次请求过大。
      for (let i = 0; i < accountNames.length; i += 10) {
        const accountNamesSlice = accountNames.slice(i, i + 10);
        const accountGroupNameMap = new Map(
          accountsToSync
            .slice(i, i + 10)
            .map((account) => [account.accountName, account.accountGroupName!]),
        );
        const accountGroupNamesSlice = Array.from(accountGroupNameMap.values());

        try {
          const scowdGroupNames = accountGroupNamesSlice.map((groupName) =>
            getScowdQuotaGroupNameForStorage(groupName, executionStorage, groupNameMap),
          );
          const executionResult = await executeStorageOperationWithFailoverWithContext(
            currentStorageId,
            storageExecutionContext,
            logger,
            async ({ executionCluster, executionPath, executionStorage }) => ({
              ...(await getScowdClient(executionCluster).storageQuota.getGroupsStorageQuota({
                groupNames: scowdGroupNames,
                path: executionPath,
                storage: buildStorageConfigProto(executionStorage),
              })),
              executionCluster,
              executionPath,
              executionStorage,
            }),
          );
          const { groupQuotaInfos } = executionResult.result;
          const successfulExecutionCluster = executionResult.executionCluster;

          const groupQuotaMbMap = new Map(
            (groupQuotaInfos ?? []).map((info: any) => [info.groupName as string, BigInt(info.usedStorageMb ?? 0)]),
          );

          for (const currentAccountName of accountNamesSlice) {
            await em.transactional(async (txEm) => {
              let accountName: string | undefined;
              const existingQuota = await txEm.findOne(
                AccountStorageQuota,
                {
                  storageId: currentStorageId,
                  account: { accountName: currentAccountName },
                },
                { lockMode: LockMode.PESSIMISTIC_WRITE },
              );
              const currentAccountGroupName = accountGroupNameMap.get(currentAccountName);
              const usage = currentAccountGroupName !== undefined
                ? groupQuotaMbMap.get(getScowdQuotaGroupNameForStorage(
                    currentAccountGroupName, executionStorage, groupNameMap,
                  )) ?? BigInt(0)
                : BigInt(0);

              if (existingQuota) {
                existingQuota.usage = usage;
                txEm.persist(existingQuota);
                accountName = currentAccountName;
              } else {
                const account = await txEm.findOne(Account, { accountName: currentAccountName });
                if (!account) {
                  return;
                }
                accountName = account.accountName;

                txEm.persist(new AccountStorageQuota({
                  account,
                  storageId: currentStorageId,
                  usage,
                }));
              }

              if (accountName !== undefined) {
                const usageGb = Math.round((Number(usage) / 1024) * 100) / 100;
                const today = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD");
                const existingDaily = await txEm.findOne(DailyStorageUsage, {
                  accountName,
                  storageId: currentStorageId,
                  date: today,
                });

                if (existingDaily) {
                  existingDaily.usages.push(usageGb);
                  txEm.persist(existingDaily);
                } else {
                  txEm.persist(new DailyStorageUsage({
                    accountName,
                    cluster: successfulExecutionCluster,
                    storageId: currentStorageId,
                    date: today,
                    usages: [usageGb],
                  }));
                }
              }
            });
          }
        } catch (error) {
          logger.error("Failed to sync account storage usage batch", {
            storageId: currentStorageId,
            tenant,
            cluster: executionCluster,
            fsType: executionStorage.fs.type,
            path: executionPath,
            accountNames: accountNamesSlice,
            error,
          });
          accountNamesSlice.forEach((currentAccountName) => {
            errors.push({
              storageId: currentStorageId,
              accountName: currentAccountName,
            });
          });
        }
      }
    }

    logger.info("Account storage usage sync completed", { errorCount: errors.length, tenant, storageId });

    return errors;
  } catch (error) {
    logger.error("Global error in account storage usage synchronization", { storageId, tenant, error });
    throw error;
  }
}
