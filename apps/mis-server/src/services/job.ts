import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ensureNotUndefined, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { FilterQuery, Loaded, QueryOrder, raw, UniqueConstraintViolationException } from "@mikro-orm/core";
import { Decimal, decimalToMoney, moneyToNumber } from "@scow/lib-decimal";
import { jobInfoToRunningjob } from "@scow/lib-scheduler-adapter";
import { checkTimeZone, convertToDateMessage } from "@scow/lib-server/build/date";
import { libCheckActivatedClusters } from "@scow/lib-server/build/misCommon/clustersActivation";
import { ChargeRecord } from "@scow/protos/build/server/charging";
import { JobBillingItem, JobFilter, JobServiceServer, JobServiceService } from "@scow/protos/build/server/job";
import { charge, pay } from "src/bl/charging";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { createPriceMap, getBillingItems, JobInfo } from "src/bl/PriceMap";
import { configClusters } from "src/config/clusters";
import { misConfig } from "src/config/mis";
import { Account, AccountState } from "src/entities/Account";
import { JobInfo as JobInfoEntity } from "src/entities/JobInfo";
import { JobPriceChange } from "src/entities/JobPriceChange";
import { AmountStrategy, JobPriceItem } from "src/entities/JobPriceItem";
import { RunningJobChargeRecord } from "src/entities/RunningJobChargeRecord";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole } from "src/entities/UserAccount";
import { getJobTotalCountCached, queryWithCache } from "src/utils/cache";
import { getJobUserAndAccountOwnerDetailsMap, JobUserAndAccountOwnerDetailsMap, toGrpc } from "src/utils/job";
import { getAccountNamesMatchedByOwner, getUserIdsMatchedByUserIdOrName } from "src/utils/jobSearch";
import { logger } from "src/utils/logger";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";
import { generateGetJobsOptions } from "src/utils/queryOptions";
import { getSchedulerAdapterJobsByClusterFeatures } from "src/utils/schedulerAdapterJobTypes";
import { ensureNoRunningSyncTask } from "src/utils/synchronizationUtils";

function filterJobs(
  {
    clusters,
    accountName,
    jobEndTimeEnd,
    tenantName,
    jobEndTimeStart,
    jobId,
    userId,
    startBiJobIndex,
    biJobIndexs,
    jobIds,
  }: JobFilter,
  ownerMatchedAccountNames?: string[],
  userMatchedUserIds?: string[],
) {
  const accountFilter = ownerMatchedAccountNames
    ? {
        account: {
          $in: ownerMatchedAccountNames,
        },
      }
    : accountName
      ? { account: accountName }
      : {};
  const userFilter = userMatchedUserIds
    ? {
        user: {
          $in: userMatchedUserIds,
        },
      }
    : userId
      ? { user: userId }
      : {};

  return {
    ...(startBiJobIndex ? { biJobIndex: { $gte: startBiJobIndex } } : {}),
    ...userFilter,
    ...(clusters.length > 0 ? { cluster: { $in: clusters } } : {}),
    ...(biJobIndexs?.length > 0 ? { biJobIndex: { $in: biJobIndexs } } : {}),
    // 优先使用 jobIds
    ...(jobIds.length > 0
      ? {
          idJob: { $in: jobIds },
          ...accountFilter,
        }
      : // 其次使用 jobId
        jobId
        ? {
            idJob: jobId,
            ...accountFilter,
          }
        : {
            ...accountFilter,
            ...(jobEndTimeEnd || jobEndTimeStart
              ? {
                  timeEnd: {
                    ...(jobEndTimeStart ? { $gte: jobEndTimeStart } : {}),
                    ...(jobEndTimeEnd ? { $lte: jobEndTimeEnd } : {}),
                  },
                }
              : {}),
          }),
    tenant: tenantName,
  } as FilterQuery<JobInfoEntity>;
}

export const jobServiceServer = plugin((server) => {
  server.addService<JobServiceServer>(JobServiceService, {
    getJobs: async ({ request, em, logger }) => {
      const { filter, page, pageSize, sortBy, sortOrder } = ensureNotUndefined(request, ["filter"]);

      const trimmedUserIdOrName = filter.userIdOrName?.trim();
      const trimmedOwnerIdOrName = filter.ownerIdOrName?.trim();

      let userMatchedUserIds: string[] | undefined = undefined;
      if (trimmedUserIdOrName) {
        const matchedUsers = await getUserIdsMatchedByUserIdOrName(em, trimmedUserIdOrName);
        userMatchedUserIds = filter.userId
          ? matchedUsers.includes(filter.userId)
            ? [filter.userId]
            : []
          : matchedUsers;

        if (userMatchedUserIds.length === 0) {
          return [
            {
              totalCount: 0,
              jobs: [],
              totalAccountPrice: decimalToMoney(new Decimal(0)),
              totalTenantPrice: decimalToMoney(new Decimal(0)),
            },
          ];
        }
      }

      let ownerMatchedAccountNames: string[] | undefined = undefined;
      if (trimmedOwnerIdOrName) {
        const matchedAccounts = await getAccountNamesMatchedByOwner(em, trimmedOwnerIdOrName);
        ownerMatchedAccountNames = filter.accountName
          ? matchedAccounts.includes(filter.accountName)
            ? [filter.accountName]
            : []
          : matchedAccounts;

        if (ownerMatchedAccountNames.length === 0) {
          return [
            {
              totalCount: 0,
              jobs: [],
              totalAccountPrice: decimalToMoney(new Decimal(0)),
              totalTenantPrice: decimalToMoney(new Decimal(0)),
            },
          ];
        }
      }

      const sqlFilter = filterJobs(filter, ownerMatchedAccountNames, userMatchedUserIds);

      logger.info("getJobs sqlFilter %s", JSON.stringify(sqlFilter));
      let jobs: Loaded<JobInfoEntity, never, "*", never>[], count: number;

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

      // 获取jobIds用于关联查询
      const jobIds = jobs.map((job) => job.biJobIndex);

      // 获取用户姓名、账户拥有者ID和姓名的map
      let jobUserAndAccountOwnerDetailsMap: JobUserAndAccountOwnerDetailsMap = {};

      if (jobIds.length > 0) {
        jobUserAndAccountOwnerDetailsMap = await getJobUserAndAccountOwnerDetailsMap(em, jobIds);
      }

      const { total_account_price, total_tenant_price }: { total_account_price: string; total_tenant_price: string } =
        await em
          .createQueryBuilder(JobInfoEntity, "j")
          .where(sqlFilter)
          .select([
            raw("sum(j.account_price) as total_account_price"),
            raw("sum(j.tenant_price) as total_tenant_price"),
          ])
          .execute("get");

      const reply = {
        totalCount: count,
        jobs: jobs.map((job) => {
          const detail = jobUserAndAccountOwnerDetailsMap[job.biJobIndex];
          return {
            ...toGrpc(job),
            userName: detail.userName ?? undefined,
            accountOwnerId: detail.accountOwnerId ?? undefined,
            accountOwnerName: detail.accountOwnerName ?? undefined,
          };
        }),
        totalAccountPrice: decimalToMoney(new Decimal(total_account_price ?? 0)),
        totalTenantPrice: decimalToMoney(new Decimal(total_tenant_price ?? 0)),
      };
      return [reply];
    },

    changeJobPrice: async ({ request, em, logger }) => {
      // 检查当前是否有正在执行的同步用户账户操作
      await ensureNoRunningSyncTask(em, logger, "change job price task");

      const { filter, accountPrice, tenantPrice, reason, operatorId, ipAddress } = ensureNotUndefined(request, [
        "filter",
      ]);

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
        const accounts = await em.find(
          Account,
          { accountName: accountNames },
          {
            populate: ["tenant"],
          },
        );

        const accountMap: Record<string, (typeof accounts)[0]> = accounts.reduce((prev, curr) => {
          prev[curr.accountName] = curr;
          return prev;
        }, {});

        const savedFields = misConfig.jobChargeMetadata?.savedFields;

        const currentActivatedClusters = await getActivatedClusters(em, logger);

        await Promise.all(
          jobs.map(async (x) => {
            logger.info(
              "Change the prices of job %s from %s(tenant), $s(account) -> %s(tenant), %s(account)",
              x.biJobIndex,
              x.tenantPrice.toFixed(2),
              x.accountPrice.toFixed(2),
              newTenantPrice?.toFixed(2) ?? "not changed",
              newAccountPrice?.toFixed(2) ?? "not changed",
            );

            // change the price of the account
            const account = accountMap[x.account];

            if (!account) {
              throw {
                code: status.NOT_FOUND,
                message: `Unknown account ${x.account} of job ${x.biJobIndex}`,
              } as ServiceError;
            }

            if (account.state === AccountState.DELETED) {
              throw {
                code: status.NOT_FOUND,
                message: `Account ${x.account} for job ${x.biJobIndex} has been deleted.`,
              } as ServiceError;
            }

            const comment = `job biJobIndex ${x.biJobIndex}`;

            const metadataMap: ChargeRecord["metadata"] = {};
            savedFields?.forEach((field) => {
              metadataMap[field] = x[field];
            });

            if (newTenantPrice) {
              if (x.tenantPrice.lt(newTenantPrice)) {
                await charge(
                  {
                    target: account.tenant.$,
                    comment,
                    type,
                    amount: newTenantPrice.minus(x.tenantPrice),
                    metadata: metadataMap,
                  },
                  em,
                  currentActivatedClusters,
                  logger,
                  server.ext,
                );
              } else if (x.tenantPrice.gt(newTenantPrice)) {
                await pay(
                  {
                    target: account.tenant.$,
                    comment: comment + `, job user ${x.user}`,
                    amount: x.tenantPrice.minus(newTenantPrice),
                    operatorId,
                    type,
                    ipAddress,
                  },
                  em,
                  currentActivatedClusters,
                  logger,
                  server.ext,
                  server.ext,
                );
              }
              x.tenantPrice = newTenantPrice;
            }

            if (newAccountPrice) {
              if (x.accountPrice.lt(newAccountPrice)) {
                await charge(
                  {
                    target: account,
                    comment,
                    type,
                    amount: newAccountPrice.minus(x.accountPrice),
                    userId: x.user,
                    metadata: metadataMap,
                  },
                  em,
                  currentActivatedClusters,
                  logger,
                  server.ext,
                );
              } else if (x.accountPrice.gt(newAccountPrice)) {
                await pay(
                  {
                    target: account,
                    comment: comment + `, job user ${x.user}`,
                    amount: x.accountPrice.minus(newAccountPrice),
                    operatorId,
                    type,
                    ipAddress,
                  },
                  em,
                  currentActivatedClusters,
                  logger,
                  server.ext,
                  server.ext,
                );
              }
              x.accountPrice = newAccountPrice;
            }
          }),
        );

        return [{ count: jobs.length }];
      });
    },

    getJobByBiJobIndex: async ({ request, em }) => {
      const { biJobIndex } = request;

      const job = await em.findOne(JobInfoEntity, { biJobIndex: +biJobIndex });

      if (!job) {
        throw {
          code: Status.NOT_FOUND,
          message: `Job ${biJobIndex} is not found`,
        } as ServiceError;
      }

      return [{ info: toGrpc(job) }];
    },

    getRunningJobs: async ({ request, em, logger }) => {
      const { cluster, userId, accountName, tenantName, jobIdList, userIdOrName, ownerIdOrName } = request;
      const trimmedUserIdOrName = userIdOrName?.trim();
      const trimmedOwnerIdOrName = ownerIdOrName?.trim();

      const tenantAccounts =
        tenantName !== undefined
          ? (await em.find(Account, { tenant: { name: tenantName } }, { fields: ["accountName"] })).map(
              (x) => x.accountName,
            )
          : [];

      if (tenantAccounts.length > 0 && !!accountName && !tenantAccounts.includes(accountName)) {
        return [{ jobs: [] }];
      }

      const accountNames = accountName !== undefined ? [accountName] : tenantName !== undefined ? tenantAccounts : [];

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const reply = await server.ext.clusters.callOnOne(cluster, logger, async (client) => {
        const fields = [
          "job_id",
          "partition",
          "name",
          "user",
          "state",
          "elapsed_seconds",
          "nodes_req",
          "nodes_alloc",
          "node_list",
          "reason",
          "account",
          "cpus_req",
          "cpus_alloc",
          "gpus_req",
          "gpus_alloc",
          "qos",
          "submit_time",
          "time_limit_minutes",
          "working_directory",
          "mem_req_mb",
          "mem_alloc_mb",
          "start_time",
          "end_time",
        ];

        const runningJobs = await getSchedulerAdapterJobsByClusterFeatures(client, configClusters[cluster], {
          fields,
          filter: {
            users: userId ? [userId] : [],
            accounts: accountNames,
            // ai集群中才有 QUEUED 状态的作业
            states: ["RUNNING", "PENDING", ...(configClusters[cluster].ai.enabled ? ["QUEUED"] : [])],
          },
        }).then((x) => x.jobs);

        if (jobIdList.length > 0) {
          const filteredJobs = runningJobs.filter((job) => jobIdList.includes(job.jobId.toString()));
          return filteredJobs;
        } else {
          return runningJobs;
        }
      });

      const runningJobIds = reply.map((job) => Number(job.jobId)).filter((x) => !Number.isNaN(x));

      const runningJobChargeRecordMap =
        runningJobIds.length > 0
          ? (await em.find(RunningJobChargeRecord, { cluster, jobId: { $in: runningJobIds } })).reduce(
              (map, record) => {
                map.set(record.jobId, record);
                return map;
              },
              new Map<number, RunningJobChargeRecord>(),
            )
          : new Map<number, RunningJobChargeRecord>();

      const runningJobs = reply.map((job) => {
        const runningJob = jobInfoToRunningjob(job);
        const chargeRecord = runningJobChargeRecordMap.get(Number(job.jobId));

        if (chargeRecord) {
          runningJob.accountPrice = decimalToMoney(chargeRecord.accountPrice);
          runningJob.tenantPrice = decimalToMoney(chargeRecord.tenantPrice);
          runningJob.chargingPeriod = {
            startTime: chargeRecord.startTime.toISOString(),
            endTime: chargeRecord.lastChargeTime.toISOString(),
          };
        }

        return runningJob;
      });

      const runningUsers = [...new Set(runningJobs.map((job) => job.user))];
      const runningAccounts = [...new Set(runningJobs.map((job) => job.account))];

      const userNameMap = new Map<string, string>();
      if (runningUsers.length > 0) {
        const users = await em.find(User, { userId: { $in: runningUsers } }, { fields: ["userId", "name"] });
        for (const user of users) {
          userNameMap.set(user.userId, user.name);
        }
      }

      const accountOwnerMap = new Map<string, { accountOwnerId: string; accountOwnerName: string }>();
      if (runningAccounts.length > 0) {
        const ownerRelations = await em.find(
          UserAccount,
          {
            account: { accountName: { $in: runningAccounts } },
            role: UserRole.OWNER,
          },
          { populate: ["account", "user"] },
        );

        for (const relation of ownerRelations) {
          const runningAccountName = relation.account.$.accountName;
          if (!accountOwnerMap.has(runningAccountName)) {
            accountOwnerMap.set(runningAccountName, {
              accountOwnerId: relation.user.$.userId,
              accountOwnerName: relation.user.$.name,
            });
          }
        }
      }

      const jobsWithExtraInfo = runningJobs.map((job) => {
        const owner = accountOwnerMap.get(job.account);
        job.userName = userNameMap.get(job.user);
        job.accountOwnerId = owner?.accountOwnerId;
        job.accountOwnerName = owner?.accountOwnerName;

        return job;
      });

      const filteredByUser = trimmedUserIdOrName
        ? jobsWithExtraInfo.filter((job) => {
            const matchedByUserId = job.user.includes(trimmedUserIdOrName);
            const matchedByUserName = job.userName?.includes(trimmedUserIdOrName) ?? false;
            return matchedByUserId || matchedByUserName;
          })
        : jobsWithExtraInfo;

      const jobs = trimmedOwnerIdOrName
        ? filteredByUser.filter((job) => {
            const matchedByOwnerId = job.accountOwnerId?.includes(trimmedOwnerIdOrName) ?? false;
            const matchedByOwnerName = job.accountOwnerName?.includes(trimmedOwnerIdOrName) ?? false;
            return matchedByOwnerId || matchedByOwnerName;
          })
        : filteredByUser;

      return [
        {
          jobs,
        },
      ];
    },

    changeJobTimeLimit: async ({ request, em, logger }) => {
      const { cluster, limitMinutes, jobId } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      await server.ext.clusters.callOnOne(cluster, logger, async (client) => {
        const { timeLimitMinutes } = await asyncClientCall(client.job, "queryJobTimeLimit", { jobId: Number(jobId) });
        await asyncClientCall(client.job, "changeJobTimeLimit", {
          jobId: Number(jobId),
          deltaMinutes: limitMinutes - timeLimitMinutes,
        });
      });

      return [{}];
    },

    queryJobTimeLimit: async ({ request, em, logger }) => {
      const { cluster, jobId } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const reply = await server.ext.clusters.callOnOne(cluster, logger, async (client) =>
        asyncClientCall(client.job, "queryJobTimeLimit", { jobId: Number(jobId) }),
      );

      return [{ limit: reply.timeLimitMinutes * 60 }];
    },

    getBillingItems: async ({ request, em }) => {
      const { tenantName, activeOnly } = request;

      let tenant: Tenant | null = null;
      if (tenantName) {
        tenant = await em.findOne(Tenant, { name: tenantName });

        if (!tenant) {
          throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
        }
      }

      const billingItems = await em.find(
        JobPriceItem,
        { $or: [{ tenant: null }, { tenant }] },
        {
          populate: ["tenant"],
          orderBy: { createTime: "ASC" },
        },
      );
      logger.info("billingItems ：%o", billingItems);
      const priceItemToGrpc = (item: JobPriceItem) =>
        ({
          id: item.itemId,
          path: item.path.join("."),
          tenantName: item.tenant?.getProperty("name"),
          price: decimalToMoney(item.price),
          createTime: item.createTime.toISOString(),
          amountStrategy: item.amount,
        }) as JobBillingItem;

      const { defaultPrices, tenantSpecificPrices } = getBillingItems(billingItems);

      const activePrices = tenantName
        ? Object.values({ ...defaultPrices, ...tenantSpecificPrices[tenantName] })
        : [
            ...Object.values(defaultPrices),
            ...Object.values(tenantSpecificPrices)
              .map((x) => Object.values(x))
              .flat(),
          ];

      return [
        {
          activeItems: activePrices.map(priceItemToGrpc),
          historyItems: activeOnly ? [] : billingItems.filter((x) => !activePrices.includes(x)).map(priceItemToGrpc),
        },
      ];
    },

    getMissingDefaultPriceItems: async ({ em }) => {
      // check price map completeness
      const priceMap = await createPriceMap(em, server.ext.clusters, logger);
      const missingItems = priceMap.getMissingDefaultPriceItems();

      return [{ items: missingItems }];
    },

    calculateJobPrice: async ({ request, em }) => {
      const account = await em.findOne(
        Account,
        {
          accountName: request.account,
        },
        { populate: ["tenant"] },
      );

      if (!account?.tenant) {
        throw { code: status.NOT_FOUND, message: "Account's tenant is not found." } as ServiceError;
      }

      const mockJobInfo: JobInfo = {
        jobId: 0,
        cluster: request.cluster,
        partition: request.partition,
        qos: request.qos,
        timeUsed: request.timeSeconds,
        cpusAlloc: request.cpusAlloc,
        gpu: request.gpu,
        memReq: request.memMb,
        memAlloc: request.memMb,
        account: request.account,
        tenant: account.tenant.$.name,
        submitTime: new Date(),
      };

      const priceMap = await createPriceMap(em, server.ext.clusters, logger);
      const price = await priceMap.calculatePrice(mockJobInfo);

      return [
        {
          tenantPrice: price.tenant ? decimalToMoney(price.tenant.price) : undefined,
          accountPrice: price.account ? decimalToMoney(price.account.price) : undefined,
        },
      ];
    },

    addBillingItem: async ({ request, em }) => {
      const { tenantName, itemId, price, amountStrategy, path, description } = ensureNotUndefined(request, ["price"]);

      let tenant: Tenant | undefined = undefined;
      if (tenantName) {
        tenant = (await em.findOne(Tenant, { name: tenantName })) ?? undefined;

        if (!tenant) {
          throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
        }
      }

      const customAmountStrategies = misConfig.customAmountStrategies?.map((i) => i.id) || [];
      if (![...(Object.values(AmountStrategy) as string[]), ...customAmountStrategies].includes(amountStrategy)) {
        throw {
          code: status.INVALID_ARGUMENT,
          message: `Amount strategy ${amountStrategy} is not valid.`,
        } as ServiceError;
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
          throw { code: status.ALREADY_EXISTS, message: `${itemId} already exists.` } as ServiceError;
        } else {
          throw e;
        }
      }
    },

    getTopSubmitJobUsers: async ({ request, em }) => {
      const { startTime, endTime, topRank = 10 } = ensureNotUndefined(request, ["startTime", "endTime"]);

      const qb = em.createQueryBuilder(JobInfoEntity, "j");

      void qb
        .select([raw("j.user as userId"), raw("COUNT(*) as count")])
        .where({ timeSubmit: { $gte: startTime } })
        .andWhere({ timeSubmit: { $lte: endTime } })
        .groupBy("j.user")
        .orderBy({ [raw("COUNT(*)")]: QueryOrder.DESC })
        .limit(topRank);

      const queryResult = await queryWithCache({
        em,
        queryKeys: ["top_submit_job_users", `${startTime}`, `${endTime}`, `${topRank}`],
        queryExecutor: qb,
      });

      const results: { userId: string; count: number }[] = queryResult.result;

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
        throw { code: status.INVALID_ARGUMENT, message: "topNUsers must be between 0 and 10" } as ServiceError;
      }
      // 直接使用Knex查询构建器
      const knex = em.getKnex();

      const results: { userName: string; userId: string; count: number }[] = await knex("job_info as j")
        .select(["u.name as userName", "j.user as userId", knex.raw("COUNT(*) as count")])
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
      void qb
        .select([raw("DATE(CONVERT_TZ(j.time_submit, 'UTC', ?)) as date", [timeZone]), raw("COUNT(*) as count")])
        .where({ timeSubmit: { $gte: startTime } })
        .andWhere({ timeSubmit: { $lte: endTime } })
        .groupBy(raw("date"))
        .orderBy({ [raw("date")]: QueryOrder.DESC });

      const queryResult = await queryWithCache({
        em,
        queryKeys: ["new_job_count", `${startTime}`, `${endTime}`],
        queryExecutor: qb,
      });

      const results: { date: string; count: number }[] = queryResult.result;

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
      const { result, refreshTime } = await getJobTotalCountCached(em);

      return [{ ...result, refreshTime: refreshTime.toISOString() }];
    },

    cancelJob: async ({ request, em, logger }) => {
      const { cluster, userId, jobId } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      await server.ext.clusters.callOnOne(cluster, logger, async (client) => {
        await asyncClientCall(client.job, "cancelJob", {
          userId,
          jobId,
        });
      });

      return [{}];
    },
  });
});
