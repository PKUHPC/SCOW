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

import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { LockMode } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { moneyToNumber } from "@scow/lib-decimal/build/convertion";
import { JobChargeLimitServiceServer, JobChargeLimitServiceService } from "@scow/protos/build/server/job_charge_limit";
import { unblockUserInAccount } from "src/bl/block";
import { setJobCharge } from "src/bl/charging";
import { UserAccount, UserStatus } from "src/entities/UserAccount";
import { getUserStateInfo } from "src/utils/accountUserState";

export const jobChargeLimitServer = plugin((server) => {
  server.addService<JobChargeLimitServiceServer>(JobChargeLimitServiceService, {
    cancelJobChargeLimit: async ({ request, em, logger }) => {
      const { accountName, userId, tenantName } = request;

      await em.transactional(async (em) => {
        const userAccount = await em.findOne(UserAccount, {
          user: { userId, tenant: { name: tenantName } },
          account: { accountName, tenant: { name: tenantName } },
        }, { populate: ["user", "account"]});

        if (!userAccount) {
          throw <ServiceError>{
            code: Status.NOT_FOUND,
            details: `User ${userId} is not found in account`,
          };
        }

        if (!userAccount.jobChargeLimit) {
          throw <ServiceError> {
            code: Status.NOT_FOUND,
            details: `The user ${userId} in account ${accountName} has no limit`,
          };
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

        if (!shouldBlockUserInCluster) {
          await unblockUserInAccount(userAccount, server.ext, logger);
          userAccount.blockedInCluster = UserStatus.UNBLOCKED;
        }

      });

      return [{}];
    },

    setJobChargeLimit: async ({ request, em, logger }) => {
      const { accountName, limit, userId, tenantName } = ensureNotUndefined(request, ["limit"]);

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
        (userAccount?.usedJobCharge && userAccount.usedJobCharge.isGreaterThan(limitNumber))) {
          throw <ServiceError> {
            code: Status.INVALID_ARGUMENT, message: userAccount?.usedJobCharge ?
              `The set quota ${limitNumber} is invalid ,
              it must be greater than or equal to the used job charge ${userAccount?.usedJobCharge}` :
              `The set quota ${limitNumber} is invalid , it must be greater than 0`,
          };
        }

        if (!userAccount) {
          throw <ServiceError>{
            code: Status.NOT_FOUND,
            details: `User ${userId} is not found in account.`,
          };
        }

        await setJobCharge(userAccount, new Decimal(moneyToNumber(limit)), server.ext, logger);

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
