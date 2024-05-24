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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { FilterQuery, QueryOrder, raw, UniqueConstraintViolationException } from "@mikro-orm/core";
import { Decimal, decimalToMoney, moneyToNumber } from "@scow/lib-decimal";
import { jobInfoToRunningjob } from "@scow/lib-scheduler-adapter";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import { ChargeRecord } from "@scow/protos/build/server/charging";
import {
  GetJobsResponse,
  JobBillingItem,
  JobFilter,
  JobServiceServer, JobServiceService } from "@scow/protos/build/server/job";
import { charge, pay } from "src/bl/charging";
import { getActiveBillingItems } from "src/bl/PriceMap";
import { misConfig } from "src/config/mis";
import { Account } from "src/entities/Account";
import { JobInfo as JobInfoEntity } from "src/entities/JobInfo";
import { JobPriceChange } from "src/entities/JobPriceChange";
import { AmountStrategy, JobPriceItem } from "src/entities/JobPriceItem";
import { Tenant } from "src/entities/Tenant";
import { callHook } from "src/plugins/hookClient";
import { queryWithCache } from "src/utils/cache";
import { toGrpc } from "src/utils/job";
import { logger } from "src/utils/logger";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";
import { generateGetJobsOptions } from "src/utils/queryOptions";

function filterJobs({
  clusters, accountName, jobEndTimeEnd, tenantName,
  jobEndTimeStart, jobId, userId, startBiJobIndex,
}: JobFilter) {

  return {
    ...startBiJobIndex ? { biJobIndex: { $gte: startBiJobIndex } } : {},
    ...userId ? { user: userId } : {},
    ...clusters.length > 0 ? { cluster: clusters } : {},
    ...jobId
      ? {
        idJob: jobId,
        ...accountName === undefined ? {} : { account: accountName },
      } : {
        ...accountName === undefined ? {} : { account: accountName },
        ...(jobEndTimeEnd || jobEndTimeStart) ? {
          timeEnd: {
            ...jobEndTimeStart ? { $gte: jobEndTimeStart } : {},
            ...jobEndTimeEnd ? { $lte: jobEndTimeEnd } : {},
          },
        } : {},
      },
    tenant: tenantName,
  } as FilterQuery<JobInfoEntity>;
}

export const jobServiceServer = plugin((server) => {

  server.addService<JobServiceServer>(JobServiceService, {

    getJobs: async ({ request, em, logger }) => {

      const { filter, page, pageSize, sortBy, sortOrder } =
      ensureNotUndefined(request, ["filter"]);

      const sqlFilter = filterJobs(filter);

      logger.info("getJobs sqlFilter %s", JSON.stringify(sqlFilter));
      let jobs, count;

      // 处理排序参数
      if (sortBy !== undefined && sortOrder !== undefined) {
        [jobs, count] = await em.findAndCount(JobInfoEntity, sqlFilter, {
          ...generateGetJobsOptions(page, pageSize, sortBy, sortOrder),
        });
      } else {
        [jobs, count] = await em.findAndCount(JobInfoEntity, sqlFilter, {
          ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
        });
      }


      const { total_account_price, total_tenant_price }: { total_account_price: string, total_tenant_price: string } =
       await em.createQueryBuilder(JobInfoEntity, "j")
         .where(sqlFilter)
         .select([raw("sum(j.account_price) as total_account_price"), raw("sum(j.tenant_price) as total_tenant_price")])
         .execute("get");

      const reply = {
        totalCount: count,
        jobs: jobs.map(toGrpc),
        totalAccountPrice: decimalToMoney(new Decimal(total_account_price)),
        totalTenantPrice: decimalToMoney(new Decimal(total_tenant_price)),
      } as GetJobsResponse;

      return [reply];
    },

    changeJobPrice: async ({ request, em, logger }) => {
      const { filter, accountPrice, tenantPrice, reason, operatorId, ipAddress } =
        ensureNotUndefined(request, ["filter"]);

      const type = misConfig.changeJobPriceType;
      const newAccountPrice = accountPrice ? new Decimal(moneyToNumber(accountPrice)) : undefined;
      const newTenantPrice = tenantPrice ? new Decimal(moneyToNumber(tenantPrice)) : undefined;

      return await em.transactional(async (em) => {

        const jobs = await em.find(JobInfoEntity, filterJobs(filter), {});

        const record = new JobPriceChange({
          jobs,
          newAccountPrice,
          newTenantPrice,
          time: new Date(),
          operatorId,
          reason,
          ipAddress,
        });

        await em.persistAndFlush(record);

        const accountNames = Array.from(new Set(jobs.map((x) => x.account)));
        const accounts = await em.find(Account, { accountName: accountNames }, {
          populate: ["tenant"],
        });

        const accountMap: Record<string, typeof accounts[0]> = accounts.reduce((prev, curr) => {
          prev[curr.accountName] = curr;
          return prev;
        }, {});

        const savedFields = misConfig.jobChargeMetadata?.savedFields;

        await Promise.all(jobs.map(async (x) => {
          logger.info("Change the prices of job %s from %s(tenant), $s(account) -> %s(tenant), %s(account)",
            x.biJobIndex, x.tenantPrice.toFixed(2), x.accountPrice.toFixed(2),
            newTenantPrice?.toFixed(2) ?? "not changed", newAccountPrice?.toFixed(2) ?? "not changed",
          );

          // change the price of the account
          const account = accountMap[x.account];

          if (!account) {
            throw <ServiceError> {
              code: status.INTERNAL,
              message: `Unknown account ${x.account} of job ${x.biJobIndex}`,
            };
          }

          const comment = `Record id ${record.id}, job biJobIndex ${x.biJobIndex}`;

          const metadataMap: ChargeRecord["metadata"] = {};
          savedFields?.forEach((field) => {
            metadataMap[field] = x[field];
          });

          if (newTenantPrice) {
            if (x.tenantPrice.lt(newTenantPrice)) {
              await charge({
                target: account.tenant.$,
                comment,
                type,
                amount: newTenantPrice.minus(x.tenantPrice),
                metadata: metadataMap,
              }, em, logger, server.ext);
            } else if (x.tenantPrice.gt(newTenantPrice)) {
              await pay({
                target: account.tenant.$,
                comment,
                amount: x.tenantPrice.minus(newTenantPrice),
                operatorId,
                type,
                ipAddress,
              }, em, logger, server.ext);
            }
            x.tenantPrice = newTenantPrice;
          }

          if (newAccountPrice) {
            if (x.accountPrice.lt(newAccountPrice)) {
              await charge({
                target: account,
                comment,
                type,
                amount: newAccountPrice.minus(x.accountPrice),
                userId: x.user,
                metadata: metadataMap,
              }, em, logger, server.ext);
            } else if (x.accountPrice.gt(newAccountPrice)) {
              await pay({
                target: account,
                comment,
                amount: x.accountPrice.minus(newAccountPrice),
                operatorId,
                type,
                ipAddress,
              }, em, logger, server.ext);
            }
            x.accountPrice = newAccountPrice;
          }
        }));


        return [{ count: jobs.length }];
      });
    },

    getJobByBiJobIndex: async ({ request, em }) => {
      const { biJobIndex } = request;

      const job = await em.findOne(JobInfoEntity, { biJobIndex: +biJobIndex });

      if (!job) {
        throw <ServiceError>{
          code: Status.NOT_FOUND, message: `Job ${biJobIndex} is not found`,
        };
      }

      return [{ info: toGrpc(job) }];
    },

    getRunningJobs: async ({ request, em, logger }) => {
      const { cluster, userId, accountName, tenantName, jobIdList } = request;

      const tenantAccounts = tenantName !== undefined
        ? (await em.find(Account, { tenant: { name: tenantName } }, { fields: ["accountName"]}))
          .map((x) => x.accountName) : [];

      if (tenantAccounts.length > 0 && !!accountName && !tenantAccounts.includes(accountName)) {
        return [{ jobs: []}];
      }

      const accountNames = accountName !== undefined
        ? [accountName]
        : tenantName !== undefined
          ? tenantAccounts : [];

      const reply = await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => {
          const fields = [
            "job_id", "partition", "name", "user", "state", "elapsed_seconds",
            "nodes_alloc", "node_list", "reason", "account", "cpus_alloc", "gpus_alloc",
            "qos", "submit_time", "time_limit_minutes", "working_directory",
          ];

          const runningJobs = await asyncClientCall(client.job, "getJobs", {
            fields,
            filter: { users: userId ? [userId] : [], accounts: accountNames, states: ["RUNNING", "PENDING"]},
          }).then((x) => x.jobs);

          if (jobIdList.length > 0) {
            const filteredJobs = runningJobs.filter((job) => jobIdList.includes(job.jobId.toString()));
            return filteredJobs;
          } else {
            return runningJobs;
          }
        },
      );

      return [{ jobs: reply.map(jobInfoToRunningjob) }];

    },

    changeJobTimeLimit: async ({ request, logger }) => {
      const { cluster, limitMinutes, jobId, operatorUserId } = request;

      await callHook("allowChangeJobTimeLimit", { cluster, limitMinutes, jobId, operatorUserId }, logger);

      await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => {
          const { timeLimitMinutes } = await asyncClientCall(client.job, "queryJobTimeLimit", { jobId: Number(jobId) });
          await asyncClientCall(client.job, "changeJobTimeLimit", {
            jobId: Number(jobId), deltaMinutes: limitMinutes - timeLimitMinutes,
          });
        },
      );

      return [{}];
    },

    queryJobTimeLimit: async ({ request, logger }) => {

      const { cluster, jobId } = request;

      const reply = await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => asyncClientCall(client.job, "queryJobTimeLimit", { jobId: Number(jobId) }),
      );

      return [{ limit: reply.timeLimitMinutes * 60 }];
    },

    getBillingItems: async ({ request, em }) => {
      const { tenantName, activeOnly } = request;

      let tenant: Tenant | null = null;
      if (tenantName) {
        tenant = await em.findOne(Tenant, { name: tenantName });

        if (!tenant) {
          throw <ServiceError>{ code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` };
        }
      }

      const billingItems = await em.find(JobPriceItem, { $or: [{ tenant: null }, { tenant }]},
        {
          populate: ["tenant"],
          orderBy: { createTime: "ASC" },
        });
      logger.info("billingItems ：%o", billingItems);
      const priceItemToGrpc = (item: JobPriceItem) => <JobBillingItem>({
        id: item.itemId,
        path: item.path.join("."),
        tenantName: item.tenant?.getProperty("name"),
        price: decimalToMoney(item.price),
        createTime: item.createTime.toISOString(),
        amountStrategy: item.amount,
      });

      const { defaultPrices, tenantSpecificPrices } = getActiveBillingItems(billingItems);

      const activePrices = tenantName
        ? Object.values({ ...defaultPrices, ...tenantSpecificPrices[tenantName] })
        : [
          ...Object.values(defaultPrices),
          ...Object.values(tenantSpecificPrices).map((x) => Object.values(x)).flat(),
        ];

      return [{
        activeItems: activePrices.map(priceItemToGrpc),
        historyItems: activeOnly ? [] : billingItems.filter((x) => !activePrices.includes(x)).map(priceItemToGrpc) }];
    },

    getMissingDefaultPriceItems: async () => {

      // check price map completeness
      const priceMap = await server.ext.price.createPriceMap();
      const missingItems = priceMap.getMissingDefaultPriceItems();

      return [{ items: missingItems }];

    },

    addBillingItem: async ({ request, em }) => {
      const { tenantName, itemId, price, amountStrategy, path, description } = ensureNotUndefined(request, ["price"]);

      let tenant: Tenant | undefined = undefined;
      if (tenantName) {
        tenant = await em.findOne(Tenant, { name: tenantName }) ?? undefined;

        if (!tenant) {
          throw <ServiceError>{ code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` };
        }
      }

      const customAmountStrategies = misConfig.customAmountStrategies?.map((i) => i.id) || [];
      if (![...(Object.values(AmountStrategy) as string[]), ...customAmountStrategies].includes(amountStrategy)) {
        throw <ServiceError>{
          code: status.INVALID_ARGUMENT,
          message: `Amount strategy ${amountStrategy} is not valid.`,
        };
      }

      const item = new JobPriceItem({
        amount: amountStrategy,
        itemId,
        price: new Decimal(moneyToNumber(price)),
        description: description ?? "",
        tenant,
        path: path.split("."),
      });

      try {
        await em.persistAndFlush(item);
        return [{}];
      } catch (e) {
        if (e instanceof UniqueConstraintViolationException) {
          throw <ServiceError>{ code: status.ALREADY_EXISTS, message: `${itemId} already exists.` };
        } else {
          throw e;
        }
      }

    },

    getTopSubmitJobUsers: async ({ request, em }) => {
      const { startTime, endTime, topRank = 10 } = ensureNotUndefined(request, ["startTime", "endTime"]);

      const qb = em.createQueryBuilder(JobInfoEntity, "j");
      qb
        .select([raw("j.user as userId"), raw("COUNT(*) as count")])
        .where({ timeSubmit: { $gte: startTime } })
        .andWhere({ timeSubmit: { $lte: endTime } })
        .groupBy("j.user")
        .orderBy({ [raw("COUNT(*)")]: QueryOrder.DESC })
        .limit(topRank);

      const results: {userId: string, count: number}[] = await queryWithCache({
        em,
        queryKeys: ["top_submit_job_users", `${startTime}`, `${endTime}`, `${topRank}`],
        queryQb: qb,
      });
      return [
        {
          results,
        },
      ];
    },

    // 返回用户名，需要联表查询
    getUsersWithMostJobSubmissions: async ({ request, em }) => {
      // topNUsers不传默认为10，最大限制为10
      const { startTime, endTime, topNUsers = 10 } = ensureNotUndefined(request, ["startTime", "endTime"]);

      // 控制topNUsers的数量
      if (typeof topNUsers == "number" && (topNUsers > 10 || topNUsers < 0)) {
        throw <ServiceError> { code: status.INVALID_ARGUMENT, message:"topNUsers must be between 0 and 10" };
      }
      // 直接使用Knex查询构建器
      const knex = em.getKnex();

      const results: {userName: string, userId: string, count: number}[] = await knex("job_info as j")
        .select([
          "u.name as userName",
          "j.user as userId",
          knex.raw("COUNT(*) as count"),
        ])
        .join("user as u", "u.user_id", "=", "j.user")
        .where("j.time_submit", ">=", startTime)
        .andWhere("j.time_submit", "<=", endTime)
        .groupBy("j.user")
        .orderBy("count", "desc")
        .limit(Math.min(topNUsers, 10));

      // 直接返回构建的结果
      return [
        {
          results,
        },
      ];
    },


    getNewJobCount: async ({ request, em }) => {
      const { startTime, endTime, timeZone = "UTC" } = ensureNotUndefined(request, ["startTime", "endTime"]);

      checkTimeZone(timeZone);

      const qb = em.createQueryBuilder(JobInfoEntity, "j");
      qb
        .select([
          raw("DATE(CONVERT_TZ(j.time_submit, 'UTC', ?)) as date", [timeZone]),
          raw("COUNT(*) as count")])
        .where({ timeSubmit: { $gte: startTime } })
        .andWhere({ timeSubmit: { $lte: endTime } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const results: {date: string, count: number}[] = await queryWithCache({
        em,
        queryKeys: ["new_job_count", `${startTime}`, `${endTime}`],
        queryQb: qb,
      });
      return [
        {
          results: results.map((record) => ({
            date: convertToDateMessage(record.date, logger),
            count: record.count,
          })),
        },
      ];
    },

    getJobTotalCount: async ({ em }) => {
      const count = await em.count(JobInfoEntity, {});
      return [{ count }];
    },

    cancelJob: async ({ request, logger }) => {
      const { cluster, userId, jobId } = request;

      await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => {
          await asyncClientCall(client.job, "cancelJob", {
            userId, jobId,
          });
        },
      );

      return [{}];
    },
  });
});
