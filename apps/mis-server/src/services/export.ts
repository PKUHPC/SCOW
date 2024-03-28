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

import { createWriterExtensions, ServiceError } from "@ddadaal/tsgrpc-common";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { Loaded } from "@mikro-orm/core";
import { decimalToMoney } from "@scow/lib-decimal";
import { account_AccountStateFromJSON } from "@scow/protos/build/server/account";
import {
  ExportServiceServer,
  ExportServiceService } from "@scow/protos/build/server/export";
import {
  platformRoleFromJSON,
  platformRoleToJSON, SortDirection, tenantRoleFromJSON, tenantRoleToJSON } from "@scow/protos/build/server/user";
import { Account, AccountState } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { User } from "src/entities/User";
import { UserRole, UserStatus } from "src/entities/UserAccount";
import { getAccountStateInfo } from "src/utils/accountUserState";
import {
  getChargesSearchType,
  getChargesTargetSearchParam,
  getPaymentsTargetSearchParam,
} from "src/utils/chargesQuery";
import { mapUsersSortField } from "src/utils/queryOptions";

export const exportServiceServer = plugin((server) => {

  server.addService<ExportServiceServer>(ExportServiceService, {

    exportUser: async (call) => {
      const { request, em } = call;
      const {
        sortField,
        sortOrder,
        idOrName,
        tenantName,
        tenantRole,
        platformRole,
        count,
      } = request;

      const platformRoleQuery = platformRole !== undefined ? {
        platformRoles: { $like: `%${platformRoleToJSON(platformRole)}%` },
      } : {};

      const tenantRoleQuery = tenantRole !== undefined ? {
        tenantRoles: { $like: `%${tenantRoleToJSON(tenantRole)}%` },
      } : {};

      const tenantNameQuery = tenantName !== undefined ? {
        tenant: { name: tenantName },
      } : {};

      const idOrNameQuery = idOrName ? {
        $or: [
          { userId: { $like: `%${idOrName}%` } },
          { name: { $like: `%${idOrName}%` } },
        ],
      } : {};

      const query = {
        $and: [
          platformRoleQuery,
          tenantRoleQuery,
          tenantNameQuery,
          idOrNameQuery,
        ],
      };

      const recordFormat = (x: Loaded<User, "tenant" | "accounts" | "accounts.account">) => ({
        userId: x.userId,
        name: x.name,
        email: x.email,
        availableAccounts: x.accounts.getItems()
          .filter((ua) => ua.blockedInCluster === UserStatus.UNBLOCKED)
          .map((ua) => {
            return ua.account.getProperty("accountName");
          }),
        tenantName: x.tenant.$.name,
        createTime: x.createTime.toISOString(),
        tenantRoles: x.tenantRoles.map(tenantRoleFromJSON),
        platformRoles: x.platformRoles.map(platformRoleFromJSON),
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);
        const records = ((await em.find(User, query, {
          limit, offset,
          orderBy: (sortField !== undefined && sortOrder !== undefined) ?
            { [mapUsersSortField[sortField]]: sortOrder === SortDirection.ASC ? "ASC" : "DESC" } : undefined,
          populate: ["tenant", "accounts", "accounts.account"]}))
          .map(recordFormat ?? ((x) => x)));

        if (records.length === 0) {
          break;
        }
        // 分片写入
        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;
        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          // 每两百条传一次
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise(async (resolve) => {
              await writeAsync({ users: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw <ServiceError>{
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              };
            });
          }
        }

        offset += limit;
      }
    },

    exportAccount: async (call) => {
      const { request, em } = call;
      const {
        tenantName,
        accountName,
        blocked,
        debt,
        frozen,
        normal,
        count,
      } = request;

      const recordFormat = (x: Loaded<Account, "tenant" | "users" | "users.user">) => {

        const owner = x.users.getItems().find((x) => x.role === UserRole.OWNER);

        if (!owner) {
          throw <ServiceError>{
            code: status.INTERNAL, message: `Account ${x.accountName} does not have an owner`,
          };
        }

        const ownerUser = owner.user.getEntity();

        const blockThresholdAmount = x.blockThresholdAmount ?? x.tenant.$.defaultAccountBlockThreshold;
        const exportedState =
          getAccountStateInfo(x.whitelist?.id, x.state, x.balance, blockThresholdAmount).displayedState;

        return {
          accountName: x.accountName,
          tenantName: x.tenant.$.name,
          userCount: x.users.count(),
          displayedState: exportedState,
          ownerId: ownerUser.userId,
          ownerName: ownerUser.name,
          comment: x.comment,
          balance: decimalToMoney(x.balance),
          blockThresholdAmount: decimalToMoney(blockThresholdAmount),
          blocked: Boolean(x.blockedInCluster),
          state: account_AccountStateFromJSON(x.state),
        };
      };

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;
      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      const qb = em.createQueryBuilder(Account, "a")
        .select("*")
        .leftJoinAndSelect("a.users", "ua")
        .leftJoinAndSelect("ua.user", "u")
        .leftJoinAndSelect("a.tenant", "t");

      if (tenantName !== undefined) {
        qb.andWhere({ "t.name": tenantName });
      }

      if (accountName !== undefined) {
        qb.andWhere({ "a.accountName": { $like: `%${accountName}%` } });
      }

      if (blocked) {
        qb.andWhere({ "a.state": AccountState.BLOCKED_BY_ADMIN, "a.blockedInCluster": true });
      }

      if (debt) {
        qb.andWhere({ "a.state": AccountState.NORMAL })
          .andWhere("a.whitelist_id IS NULL")
          .andWhere("CASE WHEN a.block_threshold_amount IS NOT NULL"
            + " THEN a.balance <= a.block_threshold_amount ELSE a.balance <= t.default_account_block_threshold END");
      }

      if (frozen) {
        qb.andWhere({ "a.state": AccountState.FROZEN });
      }

      if (normal) {
        qb.andWhere({ "a.blockedInCluster": false });
      }

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);

        const queryResult = await qb
          .limit(limit)
          .offset(offset)
          .getResultList() as Loaded<Account, "tenant" | "users" | "users.user">[];

        const records = queryResult
          .map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }
        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          // 每两百条传一次
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise(async (resolve) => {
              await writeAsync({ accounts: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw <ServiceError>{
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              };
            });
          }
        }
        offset += limit;
      }
    },

    exportChargeRecord: async (call) => {
      const { request, em } = call;
      const {
        startTime,
        endTime,
        type,
        target,
        count,
        userIds,
      } = request;

      const searchParam = getChargesTargetSearchParam(target);
      const searchType = getChargesSearchType(type);

      const query = {
        time: { $gte: startTime, $lte: endTime },
        ...searchType,
        ...searchParam,
        ...(userIds.length > 0 ? { userId: { $in: userIds } } : {}),
      };

      const recordFormat = (x: Loaded<ChargeRecord, never>) => ({
        tenantName: x.tenantName,
        accountName: x.accountName,
        userId: x.userId,
        amount: decimalToMoney(x.amount),
        comment: x.comment,
        index: x.id,
        time: x.time.toISOString(),
        type: x.type,
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);
        const records = (await em.find(ChargeRecord, query, { limit, offset }))
          .map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }

        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          // 每两百条传一次
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise(async (resolve) => {
              await writeAsync({ chargeRecords: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw <ServiceError>{
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              };
            });
          }
        }
        offset += limit;
      }
    },

    exportPayRecord: async (call) => {
      const { request, em } = call;
      const {
        startTime,
        endTime,
        target,
        count,
      } = ensureNotUndefined(request, ["target"]);

      const searchParam = getPaymentsTargetSearchParam(target);
      const query = {
        time: { $gte: startTime, $lte: endTime },
        ...searchParam,
      };

      const recordFormat = (x: Loaded<PayRecord, never>) => ({
        tenantName: x.tenantName,
        accountName: x.accountName,
        amount: decimalToMoney(x.amount),
        comment: x.comment,
        index: x.id,
        ipAddress: x.ipAddress,
        time: x.time.toISOString(),
        type: x.type,
        operatorId: x.operatorId,
      });

      type RecordFormatReturnType = ReturnType<typeof recordFormat>;

      const batchSize = 5000;
      let offset = 0;

      const { writeAsync } = createWriterExtensions(call);

      while (offset < count) {
        const limit = Math.min(batchSize, count - offset);
        const records = (await em.find(PayRecord, query, { limit, offset }))
          .map(recordFormat ?? ((x) => x));

        if (records.length === 0) {
          break;
        }

        let data: RecordFormatReturnType[] = [];
        // 记录传输的总数量
        let writeTotal = 0;

        for (const row of records) {
          data.push(row);
          writeTotal += 1;
          if (data.length === 200 || writeTotal === records.length) {
            await new Promise(async (resolve) => {
              await writeAsync({ payRecords: data });
              // 清空暂存
              data = [];
              resolve("done");
            }).catch((e) => {
              throw <ServiceError>{
                code: status.INTERNAL,
                message: "Error when exporting file",
                details: e?.message,
              };
            });
          }
        }
        offset += limit;
      }
    },
  });
});
