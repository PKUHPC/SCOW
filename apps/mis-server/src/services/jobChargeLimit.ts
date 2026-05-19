import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { LockMode } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { moneyToNumber } from "@scow/lib-decimal/build/convertion";
import { JobChargeLimitServiceServer, JobChargeLimitServiceService } from "@scow/protos/build/server/job_charge_limit";
import { JobChargeLimitResult } from "@scow/protos/build/server/job_charge_limit";
import { unblockUserInAccount } from "src/bl/block";
import { setJobCharge } from "src/bl/charging";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { UserAccount, UserStatus } from "src/entities/UserAccount";
import { getUserStateInfo } from "src/utils/accountUserState";
import { ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

interface ResultInfo extends JobChargeLimitResult {
  code?: number;
  reason?: string;
}

export const jobChargeLimitServer = plugin((server) => {
  server.addService<JobChargeLimitServiceServer>(JobChargeLimitServiceService, {
    cancelJobChargeLimit: async ({ request, em, logger }) => {
      const { accountName, tenantName } = request;

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "cancel job charge limit task");

      const results: ResultInfo[] = [];
      const userIds = request.userIds?.length > 0 ? request.userIds : request.userId ? [request.userId] : [];
      const currentActivatedClusters = await getActivatedClusters(em, logger);

      if (userIds.length === 0) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: "Either userId or userIds must be provided",
        } as ServiceError;
      }

      for (const userId of userIds) {
        await em.transactional(async (em) => {
          try {
            const userAccount = await em.findOne(
              UserAccount,
              {
                user: { userId, tenant: { name: tenantName } },
                account: { accountName, tenant: { name: tenantName } },
              },
              {
                populate: ["user", "account"],
                lockMode: LockMode.PESSIMISTIC_WRITE,
              },
            );

            if (!userAccount) {
              results.push({
                userId,
                success: false,
                code: Status.NOT_FOUND,
                reason: `User ${userId} is not found in account`,
              });
              return;
            }

            if (!userAccount.jobChargeLimit) {
              results.push({
                userId,
                success: false,
                code: Status.NOT_FOUND,
                reason: `The user ${userId} in account ${accountName} has no limit`,
              });
              return;
            }

            userAccount.jobChargeLimit = undefined;
            userAccount.usedJobCharge = undefined;

            const shouldBlockUserInCluster = getUserStateInfo(
              userAccount.state,
              userAccount.jobChargeLimit,
              userAccount.usedJobCharge,
            ).shouldBlockInCluster;

            if (!shouldBlockUserInCluster) {
              await unblockUserInAccount(userAccount, currentActivatedClusters, server.ext, logger);
              userAccount.blockedInCluster = UserStatus.UNBLOCKED;
            }

            results.push({ userId, success: true });
          } catch (error) {
            results.push({
              userId,
              success: false,
              code: Status.INTERNAL,
              reason: JSON.stringify(error),
            });
            // 重新抛出错误，使当前用户的事务被回滚
            throw error;
          }
        });
      }

      const failedInfos = results.filter((res) => !res.success);

      if (failedInfos.length > 0) {
        logger.warn(
          failedInfos.map(
            (info) => `Failed to cancel job charge limit for user
          ${info.userId}: ${info.reason}`,
          ),
        );
      }

      // 如果所有用户都失败了，抛出异常
      if (failedInfos.length === userIds.length) {
        if (userIds.length === 1) {
          throw {
            code: failedInfos[0].code,
            details: failedInfos[0].reason,
          } as ServiceError;
        }

        const errorDetails = failedInfos.map((info) => `${info.userId}: ${info.reason}`).join(", ");

        throw {
          code: Status.INTERNAL,
          message: "Failed to cancel job charge limit for all users",
          details: errorDetails,
        } as ServiceError;
      }

      return [
        {
          success: failedInfos.length === 0,
          results,
        },
      ];
    },

    setJobChargeLimit: async ({ request, em, logger }) => {
      const { accountName, limit, tenantName } = ensureNotUndefined(request, ["limit"]);

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "set job charge limit task");

      const results: ResultInfo[] = [];
      const userIds = request.userIds?.length > 0 ? request.userIds : request.userId ? [request.userId] : [];
      const limitNumber = moneyToNumber(limit);

      if (userIds.length === 0) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: "Either userId or userIds must be provided",
        } as ServiceError;
      }

      if (limitNumber <= 0) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: `The set quota ${limitNumber} is invalid, it must be greater than 0`,
        } as ServiceError;
      }

      const currentActivatedClusters = await getActivatedClusters(em, logger);

      for (const userId of userIds) {
        await em.transactional(async (em) => {
          try {
            const userAccount = await em.findOne(
              UserAccount,
              {
                user: { userId, tenant: { name: tenantName } },
                account: { accountName, tenant: { name: tenantName } },
              },
              {
                populate: ["user", "account"],
                lockMode: LockMode.PESSIMISTIC_WRITE,
              },
            );

            if (!userAccount) {
              results.push({
                userId,
                success: false,
                code: Status.NOT_FOUND,
                reason: `User ${userId} is not found in account`,
              });
              return;
            }

            if (userAccount.usedJobCharge?.isGreaterThan(limitNumber)) {
              results.push({
                userId,
                success: false,
                code: Status.INVALID_ARGUMENT,
                reason: `The set quota ${limitNumber} is invalid,
                   it must be greater than or equal to the used job charge ${userAccount.usedJobCharge.toNumber()}`,
              });
              return;
            }

            await setJobCharge(
              userAccount,
              new Decimal(moneyToNumber(limit)),
              currentActivatedClusters,
              server.ext,
              logger,
            );

            results.push({ userId, success: true });

            logger.info(
              "Set %s job charge limit to user %s account %s. Current used %s",
              userAccount.jobChargeLimit!.toFixed(2),
              userId,
              accountName,
              userAccount.usedJobCharge!.toFixed(2),
            );
          } catch (error) {
            // 捕获单个用户操作中的异常
            logger.error(`Error setting job charge limit for user ${userId}: %s`, error);
            results.push({
              userId,
              success: false,
              code: Status.INTERNAL,
              reason: `Unknown error occurred for user ${userId}`,
            });

            // 重新抛出错误，使当前用户的事务被回滚
            throw error;
          }
        });
      }

      const failedInfos = results.filter((res) => !res.success);

      if (failedInfos.length > 0) {
        logger.warn(
          failedInfos.map(
            (info) => `Failed to set job charge limit for user
          ${info.userId}: ${info.reason}`,
          ),
        );
      }

      // 如果所有用户都失败了，抛出异常
      if (failedInfos.length === userIds.length) {
        if (userIds.length === 1) {
          throw {
            code: failedInfos[0].code,
            details: failedInfos[0].reason,
          } as ServiceError;
        }

        const errorDetails = failedInfos.map((info) => `${info.userId}: ${info.reason}`).join(", ");

        throw {
          code: Status.INTERNAL,
          message: "Failed to set job charge limit for all users",
          details: errorDetails,
        } as ServiceError;
      }

      return [
        {
          success: failedInfos.length === 0,
          results,
        },
      ];
    },
  });
});
