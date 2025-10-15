import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { LockMode, QueryOrder, raw } from "@mikro-orm/core";
import { Decimal, decimalToMoney, moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { ChargeRecord as ChargeRecordProto,
  ChargingServiceServer, ChargingServiceService } from "@scow/protos/build/server/charging";
import { charge, pay } from "src/bl/charging";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { misConfig } from "src/config/mis";
import { Account,AccountState } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { Tenant } from "src/entities/Tenant";
import { getChargeRecordsTotalCountCached, queryWithCache } from "src/utils/cache";
import {
  getChargesSearchType,
  getChargesSearchTypes,
  getChargesTargetSearchParam,
  getPaymentsSearchType,
  getPaymentsTargetSearchParam,
} from "src/utils/chargesQuery";
import { CHARGE_TYPE_OTHERS } from "src/utils/constants";
import { DEFAULT_PAGE_SIZE } from "src/utils/orm";
import { mapChargesSortField } from "src/utils/queryOptions";
import { ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

export const chargingServiceServer = plugin((server) => {

  server.addService<ChargingServiceServer>(ChargingServiceService, {

    getBalance: async ({ request, em }) => {
      const { tenantName, accountName } = request;

      const entity = accountName === undefined
        ? await em.findOne(Tenant, { name: tenantName })
        : await em.findOne(Account, { tenant: { name: tenantName }, accountName });

      if (!entity) {
        if (accountName === undefined) {
          throw {
            code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found`,
          } as ServiceError;
        } else {
          throw {
            code: status.NOT_FOUND, message: `Tenant ${tenantName} or account  ${accountName} is not found`,
          } as ServiceError;
        }
      }

      return [{ balance: decimalToMoney(entity.balance) }];
    },

    pay: async ({ request, em, logger }) => {

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "pay task");

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
            throw {
              code: status.NOT_FOUND, message: `Tenant  ${tenantName} is not found`,
            } as ServiceError;
          } else {
            throw {
              code: status.NOT_FOUND, message: `Account ${accountName} or tenant ${tenantName} is not found`,
            } as ServiceError;
          }

        }

        if (accountName && target) { // 是账户
          const { state } = target as Account;
          if (state === AccountState.DELETED) {
            throw {
              code: status.FAILED_PRECONDITION,
              message: `Account  ${accountName} has been deleted`,
            } as ServiceError;
          }
        }

        const currentActivatedClusters = await getActivatedClusters(em, logger);

        return await pay({
          amount: new Decimal(moneyToNumber(amount)),
          comment,
          target,
          type,
          ipAddress,
          operatorId,
        }, em, currentActivatedClusters, logger, server.ext, server.ext);
      });

      return [{
        currentBalance: decimalToMoney(reply.currentBalance),
        previousBalance: decimalToMoney(reply.previousBalance),
      }];
    },


    charge: async ({ request, em, logger }) => {

      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "fee deduction task");

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
            throw {
              code: status.NOT_FOUND, message: `Tenant  ${tenantName} is not found`,
            } as ServiceError;
          } else {
            throw {
              code: status.NOT_FOUND, message: `Account  ${accountName} or tenant  ${tenantName} is not found`,
            } as ServiceError;
          }
        }

        if (accountName && target) { // 是账户
          const { state } = target as Account;
          if (state === AccountState.DELETED) {
            throw {
              code: status.NOT_FOUND, message: `Account  ${accountName} has been deleted`,
            } as ServiceError;
          }
        }

        const currentActivatedClusters = await getActivatedClusters(em, logger);

        return await charge({
          amount: new Decimal(moneyToNumber(amount)),
          comment,
          target,
          type,
          userId,
          metadata,
        }, em, currentActivatedClusters, logger, server.ext);
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
     * case accountsOfTenant: 返回这个租户（tenantName）下多个账户的充值记录
     *
     * @returns
     */
    getPaymentRecords: async ({ request, em }) => {

      const { endTime, startTime, target, types } =
      ensureNotUndefined(request, ["startTime", "endTime", "target", "types"]);

      const searchParam = getPaymentsTargetSearchParam(target);
      const searchTypes = getPaymentsSearchType(types);
      const records = await em.find(PayRecord, {
        time: { $gte: startTime, $lte: endTime },
        ...searchParam,
        ...searchTypes,
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
        misConfig.quantumJobChargeType,
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

      // 直接使用Knex查询构建器
      const knex = em.getKnex();

      // 查询消费记录
      const results: { account_name: string, user_name: string, chargedAmount: number }[] =
      // 从pay_record表中查询
      await knex("charge_record as cr")
      // 选择account_name字段
      // 选择user表中的name字段，并将其命名为user_name
      // 计算amount字段的总和，并将其命名为totalAmount
        .select(["cr.account_name", "u.name as user_name", knex.raw("SUM(amount) as chargedAmount")])
        .join("user as u", "u.user_id", "=", "cr.user_id")
        .where("cr.time", "<=", endTime)
        .andWhere("cr.time", ">=", startTime)
        // 过滤为空的情况
        .whereNotNull("cr.account_name")
        // 按account_name和user_name分组
        .groupBy(["cr.account_name", "u.name"])
      // 按totalAmount降序排序
        .orderBy("chargedAmount", "desc")
      // 限制结果的数量为topRank
        .limit(topRank);

      return [
        {
          results: results.map((x) => ({
            accountName: x.account_name,
            userName:x.user_name,
            chargedAmount: numberToMoney(x.chargedAmount),
          })),
        },
      ];
    },

    getDailyCharge: async ({ request, em, logger }) => {

      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(ChargeRecord, "cr");

      void qb
        .select([
          raw("DATE(CONVERT_TZ(cr.time, 'UTC', ?)) as date", [timeZone]),
          raw("SUM(cr.amount) as totalAmount"),
        ])
        .where({ time: { $gte: startTime } })
        .andWhere({ time: { $lte: endTime } })
        .andWhere({ accountName: { $ne: null } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const queryResult = await queryWithCache({
        em,
        queryKeys: ["get_daily_charge", `${startTime}`, `${endTime}`, `${timeZone}`],
        queryExecutor: qb,
      });

      const records: { date: string, totalAmount: number }[] = queryResult.result;

      return [{
        results: records.map((record) => ({
          date: convertToDateMessage(record.date, logger),
          amount: numberToMoney(record.totalAmount),
        })),
      }];
    },

    // 获取指定时间段内支付金额最高的账户信息
    getTopPayAccount: async ({ request, em }) => {
      // 从请求中获取开始时间、结束时间和前N名的数量，如果未提供topRank则默认为10
      const { startTime, endTime, topRank = 10 } = ensureNotUndefined(request, ["startTime", "endTime"]);

      // 直接使用Knex查询构建器
      const knex = em.getKnex();

      // 查询支付记录
      const results: { account_name: string, user_name: string, totalAmount: number }[] =
      // 从pay_record表中查询
      await knex("pay_record as pr")
      // 选择account_name字段
      // 选择user表中的name字段，并将其命名为user_name
      // 计算amount字段的总和，并将其命名为totalAmount
        .select(["pr.account_name", "u.name as user_name", knex.raw("SUM(amount) as totalAmount")])
        // 通过accountName字段与account表连接
        .join("account as a", "a.account_name ", "=", "pr.account_name")
        // 通过account_id字段与user_account表连接
        .join("user_account as ua", "ua.account_id", "=", "a.id")
        .where("role", "=", "OWNER")
        .join("user as u", "u.id", "=", "ua.user_id")
        .where("pr.time", "<=", endTime)
        .andWhere("pr.time", ">=", startTime)
        // 过滤为空的情况
        .whereNotNull("pr.account_name")
        // 按account_name和user_name分组
        .groupBy(["pr.account_name", "u.name"])
      // 按totalAmount降序排序
        .orderBy("totalAmount", "desc")
      // 限制结果的数量为topRank
        .limit(topRank);

      return [
        {
          results: results.map((x) => ({
            accountName: x.account_name,
            userName:x.user_name,
            payAmount: numberToMoney(x.totalAmount),
          })),
        },
      ];
    },

    getDailyPay: async ({ request, em, logger }) => {

      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(PayRecord, "pr");

      void qb
        .select([
          raw("DATE(CONVERT_TZ(pr.time, 'UTC', ?)) as date", [timeZone]),
          raw("SUM(pr.amount) as totalAmount"),
        ])
        .where({ time: { $gte: startTime } })
        .andWhere({ time: { $lte: endTime } })
        .andWhere({ accountName: { $ne: null } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const queryResult = await queryWithCache({
        em,
        queryKeys: ["get_daily_pay", `${startTime}`, `${endTime}`, `${timeZone}`],
        queryExecutor: qb,
      });

      const records: { date: string, totalAmount: number }[] = queryResult.result;

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
       * case accountsOfTenant: 返回这个租户（tenantName）下多个账户的消费记录
       * case accountsOfAllTenants: 返回所有租户下多个账户的消费记录
       *
       * @returns
       */
    getPaginatedChargeRecords: async ({ request, em }) => {
      const { startTime, endTime, type, types, target, page, pageSize, sortBy, sortOrder, userIdsOrNames }
      = ensureNotUndefined(request, ["startTime", "endTime"]);
      const searchParam = getChargesTargetSearchParam(target);
      const searchType = types.length === 0 ? getChargesSearchType(type) : getChargesSearchTypes(types);

      const qb = em.createQueryBuilder(ChargeRecord, "cr").select("*")
        .where({
          time: { $gte: startTime, $lte: endTime },
          ...searchParam,
          ...searchType,
        })
        .offset(((page ?? 1) - 1) * (pageSize ?? DEFAULT_PAGE_SIZE))
        .limit(pageSize ?? DEFAULT_PAGE_SIZE);

      // 排序
      if (sortBy !== undefined && sortOrder !== undefined) {
        const order = SortOrder[sortOrder] == "DESCEND" ? "desc" : "asc";
        void qb.orderBy({ [mapChargesSortField[sortBy]]: order });
      }

      const records = await (async () => {

        // 如果存在userIdsOrNames字段，则用knex
        if (userIdsOrNames && userIdsOrNames.length > 0) {
          const sql = qb.getKnexQuery().andWhere(function() {
            void this.whereIn("cr.user_id", function() {
              void this.select("user_id")
                .from("user");
              for (const idOrName of userIdsOrNames) {
                void this.orWhereRaw("user_id like " + `'%${idOrName}%'`)
                  .orWhereRaw("name like " + `'%${idOrName}%'`);
              }
            });
          });

          return await em.getConnection().execute(sql);
        } else {
          return await qb.getResult();
        }
      })();

      return [{
        results: records.map((x) => {
          return {
            tenantName: x.tenantName ?? x.tenant_name,
            accountName: x.accountName ?? x.account_name,
            amount: decimalToMoney(new Decimal(x.amount)),
            comment: x.comment,
            index: x.id,
            time: typeof x.time === "string" ? x.time : x.time?.toISOString(),
            type: x.type,
            userId: x.userId ?? x.user_id,
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
   * case accountsOfTenant: 返回这个租户（tenantName）下多个账户的消费记录
   * case accountsOfAllTenants: 返回所有租户下多个账户的消费记录
   *
   * @returns
   */
    getChargeRecordsTotalCount: async ({ request, em }) => {
      const { startTime, endTime, type, types, target, userIdsOrNames, preferCache }
      = ensureNotUndefined(request, ["startTime", "endTime"]);

      const searchParam = getChargesTargetSearchParam(target);
      const searchType = types.length === 0 ? getChargesSearchType(type) : getChargesSearchTypes(types);
      let refreshTime = new Date();

      const qb = em.createQueryBuilder(ChargeRecord, "c")
        .select([raw("count(c.id) as total_count"), raw("sum(c.amount) as total_amount")])
        .where({
          time: { $gte: startTime, $lte: endTime },
          ...searchType,
          ...searchParam,
        });

      let result;

      // 如果存在userIdsOrNames字段，则用knex
      if (userIdsOrNames && userIdsOrNames.length > 0) {
        const sql = qb.getKnexQuery().andWhere(function() {
          void this.whereIn("c.user_id", function() {
            void this.select("user_id")
              .from("user");
            for (const idOrName of userIdsOrNames) {
              void this.orWhereRaw("user_id like " + `'%${idOrName}%'`)
                .orWhereRaw("name like " + `'%${idOrName}%'`);
            }
          });
        });

        result = await em.getConnection().execute(sql);
      } else if (target?.$case === "accountsOfAllTenants" && preferCache) {

        const { result: queryResult, refreshTime: cacheTime } = await getChargeRecordsTotalCountCached(em);

        result = queryResult;
        refreshTime = cacheTime;
      } else {
        result = await qb.execute("get");
      }

      return [{
        totalAmount: decimalToMoney(new Decimal(result.total_amount ?? result[0]?.total_amount ?? 0)),
        totalCount: result.total_count ?? result[0].total_count,
        refreshTime: refreshTime.toISOString(),
      }];
    },

  });
});
