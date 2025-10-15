import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { LockMode } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { moneyToNumber } from "@scow/lib-decimal/build/convertion";
import { JobChargeLimitServiceServer, JobChargeLimitServiceService } from "@scow/protos/build/server/job_charge_limit";
import { unblockUserInAccount } from "src/bl/block";
import { setJobCharge } from "src/bl/charging";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { UserAccount, UserStatus } from "src/entities/UserAccount";
import { getUserStateInfo } from "src/utils/accountUserState";
import { ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

export const jobChargeLimitServer = plugin((server) => {
  server.addService<JobChargeLimitServiceServer>(JobChargeLimitServiceService, {
    cancelJobChargeLimit: async ({ request, em, logger }) => {
      const { accountName, userId, tenantName } = request;

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "cancel job charge limit task");

      await em.transactional(async (em) => {
        const userAccount = await em.findOne(UserAccount, {
          user: { userId, tenant: { name: tenantName } },
          account: { accountName, tenant: { name: tenantName } },
        }, { populate: ["user", "account"]});

        if (!userAccount) {
          throw {
            code: Status.NOT_FOUND,
            details: `User ${userId} is not found in account`,
          } as ServiceError;
        }

        if (!userAccount.jobChargeLimit) {
          throw {
            code: Status.NOT_FOUND,
            details: `The user ${userId} in account ${accountName} has no limit`,
          } as ServiceError;
        }

        logger.info("Job Charge Limit %s/%s of user %s account %s has been canceled.",
          userAccount.usedJobCharge?.toFixed(2),
          userAccount.jobChargeLimit.toFixed(2),
          userId,
          accountName,
        );

        userAccount.jobChargeLimit = undefined;
        userAccount.usedJobCharge = undefined;

        const shouldBlockUserInCluster = getUserStateInfo(
          userAccount.state,
          userAccount.jobChargeLimit,
          userAccount.usedJobCharge,
        ).shouldBlockInCluster;


        const currentActivatedClusters = await getActivatedClusters(em, logger);

        if (!shouldBlockUserInCluster) {
          await unblockUserInAccount(userAccount, currentActivatedClusters, server.ext, logger);
          userAccount.blockedInCluster = UserStatus.UNBLOCKED;
        }

      });

      return [{}];
    },

    setJobChargeLimit: async ({ request, em, logger }) => {
      const { accountName, limit, userId, tenantName } = ensureNotUndefined(request, ["limit"]);

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "set job charge limit task");

      await em.transactional(async (em) => {
        const userAccount = await em.findOne(UserAccount, {
          user: { userId, tenant: { name: tenantName } },
          account: { accountName, tenant: { name: tenantName } },
        }, {
          populate: ["user", "account"],
          lockMode: LockMode.PESSIMISTIC_WRITE,
        });

        const limitNumber = moneyToNumber(limit);
        // 如果设置的限额小于等于0或者小于当前已用额度则报错
        if (limitNumber <= 0 ||
        (userAccount?.usedJobCharge?.isGreaterThan(limitNumber))) {
          throw {
            code: Status.INVALID_ARGUMENT, message: userAccount?.usedJobCharge ?
              `The set quota ${limitNumber} is invalid ,
              it must be greater than or equal to the used job charge ${userAccount?.usedJobCharge.toNumber()}` :
              `The set quota ${limitNumber} is invalid , it must be greater than 0`,
          } as ServiceError;
        }

        if (!userAccount) {
          throw {
            code: Status.NOT_FOUND,
            details: `User ${userId} is not found in account.`,
          } as ServiceError;
        }

        const currentActivatedClusters = await getActivatedClusters(em, logger);

        await setJobCharge(userAccount,
          new Decimal(moneyToNumber(limit)), currentActivatedClusters, server.ext, logger);

        logger.info("Set %s job charge limit to user %s account %s. Current used %s",
          userAccount.jobChargeLimit!.toFixed(2),
          userId,
          accountName,
          userAccount.usedJobCharge!.toFixed(2),
        );
      });

      return [{}];
    },

    // addJobCharge: async ({ request, em, logger }) => {
    //   const { accountName, charge, userId } = ensureNotUndefined(request, ["charge"]);

    //   await em.transactional(async (em) => {
    //     const userAccount = await em.findOne(UserAccount, {
    //       user: { userId },
    //       account: { accountName },
    //     }, {  populate: ["user", "account"], lockMode: LockMode.PESSIMISTIC_WRITE });

    //     if (!userAccount) {
    //       throw <ServiceError>{
    //         code: Status.NOT_FOUND,
    //         details: "User is not found in account.",
    //       };
    //     }

    //     const chargeNumber = moneyToNumber(charge);
    //     if (userAccount.usedJobCharge && userAccount.jobChargeLimit) {
    //       userAccount.usedJobCharge = userAccount.usedJobCharge.plus(chargeNumber);
    //       if (userAccount.usedJobCharge.gt(userAccount.jobChargeLimit)) {
    //         await userAccount.block(server.ext.clusters);
    //       } else {
    //         await userAccount.unblock(server.ext.clusters);
    //       }

    //       logger.info("Add job charge %s to user %s account %s. Current: %s/%s",
    //         chargeNumber.toFixed(2),
    //         userId,
    //         accountName,
    //         userAccount.usedJobCharge.toFixed(2),
    //         userAccount.jobChargeLimit.toFixed(2),
    //       );
    //     }
    //   });

    //   return [{}];

    // },
  });
});
