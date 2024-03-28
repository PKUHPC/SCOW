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
import { ServiceError, status } from "@grpc/grpc-js";
import { LockMode, QueryOrder, raw } from "@mikro-orm/core";
import { Decimal, decimalToMoney, moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import { ChargeRecord as ChargeRecordProto,
  ChargingServiceServer, ChargingServiceService } from "@scow/protos/build/server/charging";
import { charge, pay } from "src/bl/charging";
import { misConfig } from "src/config/mis";
import { Account } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { Tenant } from "src/entities/Tenant";
import { queryWithCache } from "src/utils/cache";
import {
  getChargesSearchType,
  getChargesTargetSearchParam,
  getPaymentsSearchType,
  getPaymentsTargetSearchParam,
} from "src/utils/chargesQuery";
import { CHARGE_TYPE_OTHERS } from "src/utils/constants";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";

export const chargingServiceServer = plugin((server) => {

  server.addService<ChargingServiceServer>(ChargingServiceService, {

    getBalance: async ({ request, em }) => {
      const { tenantName, accountName } = request;

      const entity = accountName === undefined
        ? await em.findOne(Tenant, { name: tenantName })
        : await em.findOne(Account, { tenant: { name: tenantName }, accountName });

      if (!entity) {
        if (accountName === undefined) {
          throw <ServiceError>{
            code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found`,
          };
        } else {
          throw <ServiceError>{
            code: status.NOT_FOUND, message: `Tenant ${tenantName} or account  ${accountName} is not found`,
          };
        }
      }

      return [{ balance: decimalToMoney(entity.balance) }];
    },

    pay: async ({ request, em, logger }) => {
      const {
        accountName, tenantName, type, amount, comment, ipAddress, operatorId,
      } = ensureNotUndefined(request, ["amount"]);

      const reply = await em.transactional(async (em) => {

        const target = accountName !== undefined
          ? await em.findOne(Account, { tenant: { name: tenantName }, accountName: accountName }, {
            lockMode: LockMode.PESSIMISTIC_WRITE,
            populate: ["tenant"],
          })
          : await em.findOne(Tenant, { name: tenantName }, {
            lockMode: LockMode.PESSIMISTIC_WRITE,
          });

        if (!target) {
          if (accountName === undefined) {
            throw <ServiceError>{
              code: status.NOT_FOUND, message: `Tenant  ${tenantName} is not found`,
            };
          } else {
            throw <ServiceError>{
              code: status.NOT_FOUND, message: `Account ${accountName} or tenant ${tenantName} is not found`,
            };
          }

        }

        return await pay({
          amount: new Decimal(moneyToNumber(amount)),
          comment,
          target,
          type,
          ipAddress,
          operatorId,
        }, em, logger, server.ext);
      });

      return [{
        currentBalance: decimalToMoney(reply.currentBalance),
        previousBalance: decimalToMoney(reply.previousBalance),
      }];
    },


    charge: async ({ request, em, logger }) => {

      const { accountName, type, amount, comment, tenantName, userId, metadata }
        = ensureNotUndefined(request, ["amount"]);

      const reply = await em.transactional(async (em) => {
        const target = accountName !== undefined
          ? await em.findOne(Account, { tenant: { name: tenantName }, accountName: accountName }, {
            populate: ["tenant"],
            lockMode: LockMode.PESSIMISTIC_WRITE,
          })
          : await em.findOne(Tenant, { name: tenantName }, {
            lockMode: LockMode.PESSIMISTIC_WRITE,
          });

        if (!target) {
          if (accountName === undefined) {
            throw <ServiceError>{
              code: status.NOT_FOUND, message: `Tenant  ${tenantName} is not found`,
            };
          } else {
            throw <ServiceError>{
              code: status.NOT_FOUND, message: `Account  ${accountName} or tenant  ${tenantName} is not found`,
            };
          }
        }

        return await charge({
          amount: new Decimal(moneyToNumber(amount)),
          comment,
          target,
          type,
          userId,
          metadata,
        }, em, logger, server.ext);
      });

      return [{
        currentBalance: decimalToMoney(reply.currentBalance),
        previousBalance: decimalToMoney(reply.previousBalance),
      }];
    },

    getAllPayTypes: async ({ em }) => {
      const result: { type: string }[] = await em.createQueryBuilder(PayRecord, "c")
        .select("type", true)
        .execute("all");

      return [{ types: result.map((x) => x.type) }];
    },
    /**
     *
     * case tenant:返回这个租户（tenantName）的充值记录
     * case allTenants: 返回该所有租户充值记录
     * case specificAccountsOfTenant: 返回该这个租户（tenantName）下特定账户（[accountName]）的充值记录
     * case accountsOfTenant: 返回这个租户（tenantName）下所有账户的充值记录
     *
     * @returns
     */
    getPaymentRecords: async ({ request, em }) => {

      const { endTime, startTime, target, type } =
      ensureNotUndefined(request, ["startTime", "endTime", "target", "type"]);

      const searchParam = getPaymentsTargetSearchParam(target);
      const searchType = getPaymentsSearchType(type);

      const records = await em.find(PayRecord, {
        time: { $gte: startTime, $lte: endTime },
        ...searchParam,
        ...searchType,
      }, { orderBy: { time: QueryOrder.DESC } });

      return [{
        results: records.map((x) => ({
          tenantName: x.tenantName,
          accountName: x.accountName,
          amount: decimalToMoney(x.amount),
          comment: x.comment,
          index: x.id,
          ipAddress: x.ipAddress,
          time: x.time.toISOString(),
          type: x.type,
          operatorId: x.operatorId,
        })),
        total: decimalToMoney(records.reduce((prev, curr) => prev.plus(curr.amount), new Decimal(0))),
      }];
    },
    /**
     *
     * case tenant:返回这个租户（tenantName）的消费记录
     * case allTenants: 返回所有租户消费记录
     * case accountOfTenant: 返回这个租户（tenantName）下这个账户（accountName）的消费记录
     * case accountsOfTenant: 返回这个租户（tenantName）下所有账户的消费记录
     * case accountsOfAllTenants: 返回所有租户下所有账户的消费记录
     *
     * Deprecated Notice
     * This API function GetChargeRecords has been deprecated.
     * Use the new API function GetPaginatedChargeRecords and GetChargeRecordsTotalCount instead.
     *
     * @deprecated
     */
    getChargeRecords: async ({ request, em }) => {
      const { startTime, endTime, type, target }
        = ensureNotUndefined(request, ["startTime", "endTime"]);

      let searchParam: { tenantName?: string, accountName?: string | { $ne: null } } = {};
      switch (target?.$case)
      {
      // 当前租户的租户消费记录
      case "tenant":
        searchParam = { tenantName: target[target.$case].tenantName, accountName: undefined };
        break;
        // 所有租户的租户消费记录
      case "allTenants":
        searchParam = { accountName: undefined };
        break;
        // 当前租户下当前账户的消费记录
      case "accountOfTenant":
        searchParam = { tenantName: target[target.$case].tenantName, accountName: target[target.$case].accountName };
        break;
        // 当前租户下所有账户的消费记录
      case "accountsOfTenant":
        searchParam = { tenantName: target[target.$case].tenantName, accountName: { $ne:null } };
        break;
        // 所有租户下所有账户的消费记录
      case "accountsOfAllTenants":
        searchParam = { accountName: { $ne:null } };
        break;
      default:
        searchParam = {};
      }

      // 可查询的types类型
      const typesToSearch = [
        misConfig.jobChargeType,
        misConfig.changeJobPriceType,
        ...(misConfig.customChargeTypes || []),
      ];

      let searchType = {};
      if (!type) {
        searchType = { type: { $ne: null } };
      } else {
        if (type === CHARGE_TYPE_OTHERS) {
          searchType = { type: { $nin: typesToSearch } };
        } else {
          searchType = { type: type };
        }
      }

      const records = await em.find(ChargeRecord, {
        time: { $gte: startTime, $lte: endTime },
        ...searchType,
        ...searchParam,
      }, { orderBy: { time: QueryOrder.DESC } });

      return [{
        results: records.map((x) => ({
          tenantName: x.tenantName,
          accountName: x.accountName,
          amount: decimalToMoney(x.amount),
          comment: x.comment,
          index: x.id,
          time: x.time.toISOString(),
          type: x.type,
          userId: x.userId,
        })),
        total: decimalToMoney(records.reduce((prev, curr) => prev.plus(curr.amount), new Decimal(0))),
      }];
    },

    getTopChargeAccount: async ({ request, em }) => {
      const { startTime, endTime, topRank = 10 } = ensureNotUndefined(request, ["startTime", "endTime"]);

      const qb = em.createQueryBuilder(ChargeRecord, "cr");
      qb
        .select("cr.accountName")
        .addSelect([raw("SUM(cr.amount) as `totalAmount`")])
        .where({ time: { $gte: startTime } })
        .andWhere({ time: { $lte: endTime } })
        .andWhere({ accountName: { $ne: null } })
        .groupBy("accountName")
        .orderBy({ [raw("SUM(cr.amount)")]: QueryOrder.DESC })
        .limit(topRank);

      const results: {accountName: string, totalAmount: number}[] = await queryWithCache({
        em,
        queryKeys: ["get_top_charge_account", `${startTime}`, `${endTime}`, `${topRank}`],
        queryQb: qb,
      });

      return [
        {
          results: results.map((x) => ({
            accountName: x.accountName,
            chargedAmount: numberToMoney(x.totalAmount),
          })),
        },
      ];
    },

    getDailyCharge: async ({ request, em, logger }) => {

      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(ChargeRecord, "cr");

      qb
        .select([
          raw("DATE(CONVERT_TZ(cr.time, 'UTC', ?)) as date", [timeZone]),
          raw("SUM(cr.amount) as totalAmount"),
        ])
        .where({ time: { $gte: startTime } })
        .andWhere({ time: { $lte: endTime } })
        .andWhere({ accountName: { $ne: null } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const records: {date: string, totalAmount: number}[] = await queryWithCache({
        em,
        queryKeys: ["get_daily_charge", `${startTime}`, `${endTime}`, `${timeZone}`],
        queryQb: qb,
      });

      return [{
        results: records.map((record) => ({
          date: convertToDateMessage(record.date, logger),
          amount: numberToMoney(record.totalAmount),
        })),
      }];
    },

    getTopPayAccount: async ({ request, em }) => {
      const { startTime, endTime, topRank = 10 } = ensureNotUndefined(request, ["startTime", "endTime"]);

      const qb = em.createQueryBuilder(PayRecord, "p");
      qb
        .select("p.accountName")
        .addSelect(raw("SUM(p.amount) as `totalAmount`"))
        .where({ time: { $gte: startTime } })
        .andWhere({ time: { $lte: endTime } })
        .andWhere({ accountName: { $ne: null } })
        .groupBy("accountName")
        .orderBy({ [raw("SUM(p.amount)")]: QueryOrder.DESC })
        .limit(topRank);

      const results: {accountName: string, totalAmount: number}[] = await queryWithCache({
        em,
        queryKeys: ["get_top_pay_account", `${startTime}`, `${endTime}`, `${topRank}`],
        queryQb: qb,
      });

      return [
        {
          results: results.map((x) => ({
            accountName: x.accountName,
            payAmount: numberToMoney(x.totalAmount),
          })),
        },
      ];
    },

    getDailyPay: async ({ request, em, logger }) => {

      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(PayRecord, "pr");

      qb
        .select([
          raw("DATE(CONVERT_TZ(pr.time, 'UTC', ?)) as date", [timeZone]),
          raw("SUM(pr.amount) as totalAmount"),
        ])
        .where({ time: { $gte: startTime } })
        .andWhere({ time: { $lte: endTime } })
        .andWhere({ accountName: { $ne: null } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const records: {date: string, totalAmount: number}[] = await queryWithCache({
        em,
        queryKeys: ["get_daily_pay", `${startTime}`, `${endTime}`, `${timeZone}`],
        queryQb: qb,
      });

      return [{
        results: records.map((record) => ({
          date: convertToDateMessage(record.date, logger),
          amount: numberToMoney(record.totalAmount),
        })),
      }];
    },

    /**
       *
       * case tenant:返回这个租户（tenantName）的消费记录
       * case allTenants: 返回所有租户消费记录
       * case accountOfTenant: 返回这个租户（tenantName）下这个账户（accountName）的消费记录
       * case accountsOfTenant: 返回这个租户（tenantName）下所有账户的消费记录
       * case accountsOfAllTenants: 返回所有租户下所有账户的消费记录
       * case accounts: 返回多个特定账户的消费记录
       *
       * @returns
       */
    getPaginatedChargeRecords: async ({ request, em }) => {
      const { startTime, endTime, type, target, userIds, page, pageSize }
      = ensureNotUndefined(request, ["startTime", "endTime"]);
      const searchParam = getChargesTargetSearchParam(target);

      const searchType = getChargesSearchType(type);
      const records = await em.find(ChargeRecord, {
        time: { $gte: startTime, $lte: endTime },
        ...searchType,
        ...searchParam,
        ...(userIds.length > 0 ? { userId: { $in: userIds } } : {}),
      }, {
        ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
        orderBy: { time: QueryOrder.DESC },
      });

      return [{
        results: records.map((x) => {
          return {
            tenantName: x.tenantName,
            accountName: x.accountName,
            amount: decimalToMoney(x.amount),
            comment: x.comment,
            index: x.id,
            time: x.time.toISOString(),
            type: x.type,
            userId: x.userId,
            metadata: x.metadata as ChargeRecordProto["metadata"] ?? undefined,
          };

        }),
      }];
    },

    /**
   *
   * case tenant:返回这个租户（tenantName）的消费记录
   * case allTenants: 返回所有租户消费记录
   * case accountOfTenant: 返回这个租户（tenantName）下这个账户（accountName）的消费记录
   * case accountsOfTenant: 返回这个租户（tenantName）下所有账户的消费记录
   * case accountsOfAllTenants: 返回所有租户下所有账户的消费记录
   * case accounts: 返回多个特定账户的消费记录
   *
   * @returns
   */
    getChargeRecordsTotalCount: async ({ request, em }) => {
      const { startTime, endTime, type, target, userIds }
      = ensureNotUndefined(request, ["startTime", "endTime"]);

      const searchParam = getChargesTargetSearchParam(target);
      const searchType = getChargesSearchType(type);

      const { total_count, total_amount }: { total_count: number, total_amount: string }
        = await em.createQueryBuilder(ChargeRecord, "c")
          .select(raw("count(c.id) as total_count"))
          .addSelect(raw("sum(c.amount) as total_amount"))
          .where({
            time: { $gte: startTime, $lte: endTime },
            ...searchType,
            ...searchParam,
            ...(userIds.length > 0 ? { userId: { $in: userIds } } : {}),
          })
          .execute("get");

      return [{
        totalAmount: decimalToMoney(new Decimal(total_amount)),
        totalCount: total_count,
      }];
    },

  });
});
