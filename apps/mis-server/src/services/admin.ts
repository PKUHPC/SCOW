import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { QueryOrder } from "@mikro-orm/core";
import { libCheckActivatedClusters } from "@scow/lib-server/build/misCommon/clustersActivation";
import {
  AdminServiceServer,
  AdminServiceService,
  ClusterAccountInfo,
  ClusterAccountInfo_ImportStatus,
  listAccountUserSynchronizationsResponse_SyncResultFromJSON,
  ListAccountUserSynchronizationsResponse_SyncSessionInfo,
  listAccountUserSynchronizationsResponse_SyncStatusFromJSON,
} from "@scow/protos/build/server/admin";
import { updateBlockStatusInSlurm } from "src/bl/block";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { importUsers, ImportUsersData } from "src/bl/importUsers";
import { misConfig } from "src/config/mis";
import { Account } from "src/entities/Account";
import { AccountUserSyncRecord } from "src/entities/AccountUserSyncRecord";
import { Tenant } from "src/entities/Tenant";
import { PlatformRole, User } from "src/entities/User";
import { UserAccount, UserRole } from "src/entities/UserAccount";
import { getTotalStatisticsInfoCached } from "src/utils/cache";
import { logger } from "src/utils/logger";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";
import { checkRunningSyncTask, ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

export const adminServiceServer = plugin((server) => {
  server.addService<AdminServiceServer>(AdminServiceService, {
    importUsers: async ({ request, em, logger }) => {
      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "import users task");

      const { data, whitelist } = request;

      if (!data) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: "Submitted data is empty",
        } as ServiceError;
      }

      const ownerNotInAccount = data.accounts.find((x) => x.owner && !x.users.find((user) => user.userId === x.owner));
      if (ownerNotInAccount) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: `Owner ${ownerNotInAccount.owner} is not in ${ownerNotInAccount.accountName}`,
        } as ServiceError;
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);

      const reply = await importUsers(
        data as ImportUsersData,
        em,
        whitelist,
        currentActivatedClusters,
        server.ext.clusters,
        logger,
        server.ext.resource,
      );

      return [reply];
    },

    getClusterUsers: async ({ request, em, logger }) => {
      const { cluster } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const result = await server.ext.clusters.callOnOne(cluster, logger, async (client) => {
        // TODO: 返回值中的 accountBlockedDetails 暂未使用
        return await asyncClientCall(client.account, "getAllAccountsWithUsersAndBlockedDetails", {});
      });

      const accounts: ClusterAccountInfo[] = [];

      const includedAccounts = await em.find(
        Account,
        {
          accountName: { $in: result.accounts.map((x) => x.accountName) },
        },
        { populate: ["users", "users.user"] },
      );

      const includedUserAccounts = await em.find(
        UserAccount,
        {
          account: { accountName: result.accounts.map((x) => x.accountName) },
        },
        { populate: ["account", "user"] },
      );

      result.accounts.forEach((account) => {
        const includedAccount = includedAccounts.find((x) => x.accountName === account.accountName);
        if (!includedAccount) {
          // account not existed in scow
          accounts.push({ ...account, importStatus: ClusterAccountInfo_ImportStatus.NOT_EXISTING });
        } else {
          let status: ClusterAccountInfo_ImportStatus;

          if (
            !account.users.every((user) =>
              includedUserAccounts
                .filter((x) => x.account.$.accountName === account.accountName)
                .map((x) => x.user.$.userId)
                .includes(user.userId),
            )
          ) {
            // some users in account not existed in scow
            status = ClusterAccountInfo_ImportStatus.HAS_NEW_USERS;
          } else {
            // both users and account exist in scow
            status = ClusterAccountInfo_ImportStatus.EXISTING;
          }

          account.owner = includedUserAccounts.find(
            (x) => x.account.$.accountName === account.accountName && x.role === UserRole.OWNER,
          )?.user.$.userId;

          accounts.push({ ...account, importStatus: status });
        }
      });

      const order = {
        [ClusterAccountInfo_ImportStatus.NOT_EXISTING]: 0,
        [ClusterAccountInfo_ImportStatus.HAS_NEW_USERS]: 1,
        [ClusterAccountInfo_ImportStatus.EXISTING]: 2,
      };
      accounts.sort((a, b) => {
        return order[a.importStatus] - order[b.importStatus];
      });
      return [{ accounts }];
    },

    getFetchInfo: async () => {
      return [
        {
          fetchStarted: server.ext.fetch.started(),
          schedule: server.ext.fetch.schedule,
          lastFetchTime: server.ext.fetch.lastFetched()?.toISOString() ?? undefined,
        },
      ];
    },

    setFetchState: async ({ request }) => {
      const { started } = request;

      if (started) {
        server.ext.fetch.start();
      } else {
        server.ext.fetch.stop();
      }

      return [{}];
    },

    fetchJobs: async ({ em, logger }) => {
      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "job synchronization task");

      const reply = await server.ext.fetch.fetch();

      return [reply ? reply : { newJobsCount: 0 }];
    },

    getSyncBlockStatusInfo: async () => {
      return [
        {
          syncStarted: server.ext.syncAccountUser.started(),
          schedule: server.ext.syncAccountUser.schedule,
          lastSyncTime: server.ext.syncAccountUser.lastSyncTime()?.toISOString() ?? undefined,
        },
      ];
    },

    setSyncBlockStatusState: async ({ request }) => {
      const { started } = request;

      if (started) {
        server.ext.syncAccountUser.start();
      } else {
        server.ext.syncAccountUser.stop();
      }

      return [{}];
    },

    /**
     * Deprecated
     * 同步封锁状态功能已升级为同步账户用户数据功能
     * 此接口已不再使用
     * @param param0
     * @returns
     */
    syncBlockStatus: async ({ em, logger }) => {
      // check whether there is activated cluster in SCOW
      // cause syncBlockStatus in plugin will skip the check
      await getActivatedClusters(em, logger);
      const reply = await server.ext.syncBlockStatus.run();
      if (!reply) {
        throw new ServiceError({
          code: Status.ALREADY_EXISTS,
          message: "Sync is already running. Please wait for its completion before starting a new one.",
        });
      }
      return [reply];
    },

    updateBlockStatus: async ({ em, logger }) => {
      await updateBlockStatusInSlurm(em, server.ext.clusters, logger);
      return [{}];
    },

    getAdminInfo: async ({ em }) => {
      const userCount = await em.count(User, {});
      const accountCount = await em.count(Account, {});
      const tenantCount = await em.count(Tenant, {});
      const platformAdmins = await em.find(User, { platformRoles: { $like: `%${PlatformRole.PLATFORM_ADMIN}%` } });
      const platformFinancialStaff = await em.find(User, {
        platformRoles: { $like: `%${PlatformRole.PLATFORM_FINANCE}%` },
      });

      return [
        {
          platformAdmins: platformAdmins.map((x) => ({ userId: x.userId, userName: x.name })),
          platformFinancialStaff: platformFinancialStaff.map((x) => ({ userId: x.userId, userName: x.name })),
          tenantCount,
          accountCount,
          userCount,
        },
      ];
    },

    getStatisticInfo: async ({ request, em }) => {
      const { startTime, endTime } = request;

      const { result: totalRecords, refreshTime } = await getTotalStatisticsInfoCached(em);

      const newUser = await em.count(User, { createTime: { $gte: startTime, $lte: endTime } });
      const newAccount = await em.count(Account, { createTime: { $gte: startTime, $lte: endTime, $ne: null } });
      const newTenant = await em.count(Tenant, { createTime: { $gte: startTime, $lte: endTime } });

      return [
        {
          ...totalRecords,
          newUser,
          newAccount,
          newTenant,
          refreshTime: refreshTime.toISOString(),
        },
      ];
    },

    // 开始一个同步任务
    startAccountUserSynchronization: async ({ request, em, logger }) => {
      const { maxSyncDurationMinutes, operatorId } = request;
      // 确保当前存在在线集群
      await getActivatedClusters(em, logger);

      const sessionId = await server.ext.syncAccountUser.run(maxSyncDurationMinutes, operatorId);
      logger.trace("An account user synchronization task is started.");
      if (!sessionId) {
        throw {
          code: Status.ALREADY_EXISTS,
          message:
            "System is busy: either account user synchronization " +
            "or job synchronization task is running. Please wait for the current operation " +
            "to finish before starting a new synchronization.",
        } as ServiceError;
      }
      return [{ sessionId }];
    },

    listAccountUserSynchronizations: async ({ request, em }) => {
      const { page, pageSize } = request;
      const syncDayPeriod = misConfig.syncAccountUser.syncHistoryDayPeriod;
      const syncPeriodAgo = new Date();
      syncPeriodAgo.setDate(syncPeriodAgo.getDate() - syncDayPeriod);
      logger.trace("List account user synchronization history since %o", syncPeriodAgo);
      const [syncHistory, count] = await em.findAndCount(
        AccountUserSyncRecord,
        {
          startTime: { $gte: syncPeriodAgo },
        },
        {
          ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
          orderBy: { startTime: QueryOrder.DESC },
        },
      );

      const syncOperatorIds = syncHistory.map((x) => x.syncOperatorId);
      const userIds = syncOperatorIds.filter((id) => typeof id === "string" && id !== undefined && id !== null);
      const users = await em.find(User, { userId: userIds });
      const userMap = new Map(users.map((x) => [x.userId, x.name]));

      const results: ListAccountUserSynchronizationsResponse_SyncSessionInfo[] = syncHistory.map((sync) => {
        return {
          sessionId: sync.sessionId,
          startTime: sync.startTime.toISOString(),
          endTime:
            sync.updateTime !== undefined && sync.updateTime !== null
              ? new Date(sync.updateTime).toISOString()
              : undefined,
          operatorId: sync.syncOperatorId,
          operatorName: sync.syncOperatorId ? userMap.get(sync.syncOperatorId) : "",
          sessionSyncStatus: listAccountUserSynchronizationsResponse_SyncStatusFromJSON(sync.syncStatus),
          sessionSyncResult: sync.syncResult
            ? listAccountUserSynchronizationsResponse_SyncResultFromJSON(sync.syncResult)
            : undefined,
          sessionSyncDetails: sync.syncDetails ? { results: sync.syncDetails } : undefined,
        };
      });

      return [{ syncSessionInfos: results, totalCount: count }];
    },

    // 检查是否有正在运行的同步任务
    checkAccountUserSynchronizationRunning: async ({ em }) => {
      const isRunningSyncFound = await checkRunningSyncTask(em, logger);
      return [{ isRunning: isRunningSyncFound }];
    },
  });
});
