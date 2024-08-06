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
import { QueryOrder, raw } from "@mikro-orm/core";
import { OperationType } from "@scow/lib-operation-log";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import { StatisticServiceServer, StatisticServiceService } from "@scow/protos/build/audit/statistic";
import { OperationLog } from "src/entities/OperationLog";


export const statisticServiceServer = plugin((server) => {

  server.addService<StatisticServiceServer>(StatisticServiceService, {

    getActiveUserCount: async ({ request, em, logger }) => {

      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(OperationLog, "o");
      void qb
        .select([
          raw("DATE(CONVERT_TZ(o.operation_time, 'UTC', ?)) as date", [timeZone]),
          raw("COUNT(DISTINCT o.operator_user_id) as userCount"),
        ])
        .where({ operationTime: { $gte: startTime } })
        .andWhere({ operationTime: { $lte: endTime } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const records: { date: string, userCount: number }[] = await qb.execute();

      return [{
        results: records.map((record) => ({
          date: convertToDateMessage(record.date, logger),
          count: record.userCount,
        })),
      }];
    },

    getPortalUsageCount: async ({ request, em }) => {
      const { startTime, endTime } = ensureNotUndefined(request, ["startTime", "endTime"]);

      const portalOperationType: OperationType[] = [
        "submitJob",
        "endJob",
        "addJobTemplate",
        "deleteJobTemplate",
        "updateJobTemplate",
        "shellLogin",
        "createDesktop",
        "deleteDesktop",
        "createApp",
        "createFile",
        "deleteFile",
        "uploadFile",
        "createDirectory",
        "deleteDirectory",
        "moveFileItem",
        "copyFileItem",
      ];

      const qb = em.createQueryBuilder(OperationLog, "o");
      void qb
        .select([raw("JSON_EXTRACT(meta_data, '$.$case') as operationType"), raw("COUNT(*) as count")])
        .where({ operationTime: { $gte: startTime } })
        .andWhere({ operationTime: { $lte: endTime } })
        .andWhere({ [raw("JSON_EXTRACT(meta_data, '$.$case')")]: { $in: portalOperationType } })
        .groupBy(raw("operationType"))
        .orderBy({ [raw("count")]: QueryOrder.DESC });

      const results: { operationType: string, count: number }[] = await qb.execute();

      return [{
        results,
      }];


    },
    getMisUsageCount: async ({ request, em }) => {
      const { startTime, endTime } = ensureNotUndefined(request, ["startTime", "endTime"]);

      const misOperationType: OperationType[] = [
        "setJobTimeLimit",
        "createUser",
        "deleteUser",
        "addUserToAccount",
        "removeUserFromAccount",
        "setAccountAdmin",
        "unsetAccountAdmin",
        "blockUser",
        "unblockUser",
        "accountSetChargeLimit",
        "accountUnsetChargeLimit",
        "setTenantBilling",
        "setTenantAdmin",
        "unsetTenantAdmin",
        "setTenantFinance",
        "unsetTenantFinance",
        "tenantChangePassword",
        "createAccount",
        "deleteAccount",
        "addAccountToWhitelist",
        "removeAccountFromWhitelist",
        "accountPay",
        "blockAccount",
        "unblockAccount",
        "importUsers",
        "setPlatformAdmin",
        "unsetPlatformAdmin",
        "setPlatformFinance",
        "unsetPlatformFinance",
        "platformChangePassword",
        "setPlatformBilling",
        "createTenant",
        "tenantPay",
        "exportUser",
        "exportAccount",
        "exportChargeRecord",
        "exportPayRecord",
        "exportOperationLog",
        "setAccountBlockThreshold",
        "setAccountDefaultBlockThreshold",
      ];

      const qb = em.createQueryBuilder(OperationLog, "o");
      void qb
        .select([raw("JSON_EXTRACT(meta_data, '$.$case') as operationType"), raw("COUNT(*) as count")])
        .where({ operationTime: { $gte: startTime } })
        .andWhere({ operationTime: { $lte: endTime } })
        .andWhere({ [raw("JSON_EXTRACT(meta_data, '$.$case')")]: { $in: misOperationType } })
        .groupBy(raw("operationType"))
        .orderBy({ [raw("count")]: QueryOrder.DESC });

      const results: { operationType: string, count: number }[] = await qb.execute();

      return [{
        results,
      }];


    },
  });

});
