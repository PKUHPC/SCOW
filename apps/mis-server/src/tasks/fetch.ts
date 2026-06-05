import { Logger } from "@ddadaal/tsgrpc-server";
import { LockMode, QueryOrder } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { parsePlaceholder } from "@scow/lib-config";
import { Decimal } from "@scow/lib-decimal";
import { TargetType } from "@scow/notification-protos/build/message_common_pb";
import { ChargeRecord } from "@scow/protos/build/server/charging";
import { GetJobsResponse, JobInfo as ClusterJobInfo } from "@scow/scheduler-adapter-protos/build/job";
import { addJobCharge, charge } from "src/bl/charging";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { emptyJobPriceInfo } from "src/bl/jobPrice";
import { createPriceMap, PriceMap } from "src/bl/PriceMap";
import { misConfig } from "src/config/mis";
import { Account } from "src/entities/Account";
import { AccountUserSyncRecord, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { JobInfo } from "src/entities/JobInfo";
import { RunningJobChargeRecord } from "src/entities/RunningJobChargeRecord";
import { UserAccount } from "src/entities/UserAccount";
import { InternalMessageType } from "src/models/messageType";
import { ClusterPlugin } from "src/plugins/clusters";
import { callHook } from "src/plugins/hookClient";
import { toGrpc } from "src/utils/job";
import { getSchedulerAdapterJobsByClusterFeatures } from "src/utils/schedulerAdapterJobTypes";
import { batchSendMessages, Message } from "src/utils/sendMessage";

async function getClusterLatestDate(em: SqlEntityManager, cluster: string, logger: Logger) {
  const query = em
    .fork()
    .createQueryBuilder(JobInfo)
    .select("timeEnd")
    .where({ cluster })
    .orderBy({ timeEnd: QueryOrder.DESC });

  const { timeEnd = undefined } = (await query.execute("get")) ?? {};

  logger.info(`Latest fetched job's end_time is ${timeEnd?.toISOString() ?? "undefined"}.`);

  return timeEnd;
}

const processGetJobsResult = (cluster: string, result: GetJobsResponse) => {
  const jobs: ({ cluster: string } & ClusterJobInfo)[] = [];
  result.jobs.forEach((job) => {
    jobs.push({
      cluster,
      ...job,
    });
  });

  // sort by end time
  jobs.sort((a, b) => {
    const endTimeA = new Date(a.endTime!).getTime();
    const endTimeB = new Date(b.endTime!).getTime();
    return endTimeA - endTimeB;
  });

  return jobs;
};

export let lastFetched: Date | null = null;

export async function fetchJobs(em: SqlEntityManager<MySqlDriver>, logger: Logger, clusterPlugin: ClusterPlugin) {
  logger.info("Start fetching.");

  logger.info("Loading Tenant Account associations");

  const isSyncAccountUserRunning = await em.findOne(AccountUserSyncRecord, {
    syncStatus: SyncStatus.RUNNING,
  });
  if (isSyncAccountUserRunning) {
    logger.info("An account user synchronization task is running.This will skip fetching Jobs in cluster!");
    return [{ newJobsCount: 0 }];
  }

  const accounts = await em.find(Account, {}, { populate: ["tenant"] });

  const accountTenantMap = new Map(accounts.map((x) => [x.accountName, x.tenant.$.name]));

  const priceMap = await createPriceMap(em, clusterPlugin.clusters, logger);

  const currentActivatedClusters = await getActivatedClusters(em, logger).catch((e) => {
    logger.error("!!![important] No available activated clusters.This will skip fetching Jobs in cluster!!!");
    logger.error(e);
    return {};
  });

  // 被 SCOW 记录的作业信息，需要发送消息给用户
  const savedJobsInfo: JobInfo[] = [];

  const persistJobAndCharge = async (jobs: ({ cluster: string } & ClusterJobInfo)[]) => {
    const result = await em.transactional(async (em) => {
      // Calculate prices for new info and persist
      const pricedJobs: JobInfo[] = [];
      let pricedJob: JobInfo;
      for (const job of jobs) {
        const tenant = accountTenantMap.get(job.account);
        const submitTime = new Date(job.submitTime || job.startTime || job.endTime || Date.now());

        if (!tenant) {
          logger.warn("Account %s doesn't exist. Doesn't charge the job.", job.account);
        }

        try {
          job.elapsedSeconds = Math.max(0, Number(job.elapsedSeconds) || 0);
          const price = tenant
            ? await priceMap.calculatePrice({
                jobId: job.jobId,
                cluster: job.cluster,
                cpusAlloc: job.cpusAlloc!,
                gpu: job.gpusAlloc!,
                memAlloc: job.memAllocMb!,
                memReq: job.memReqMb,
                partition: job.partition,
                qos: job.qos,
                timeUsed: job.elapsedSeconds,
                account: job.account,
                tenant,
                submitTime,
              })
            : emptyJobPriceInfo();

          pricedJob = new JobInfo(job, tenant, price);

          em.persist(pricedJob);

          // Determine whether the job can be inserted into the database. If not, skip the job
          await em.flush();
        } catch (error) {
          logger.error("invalid job. cluster: %s, jobId: %s, error: %s", job.cluster, job.jobId, error);
          throw error;
        }

        const account = await em.findOne(
          Account,
          {
            accountName: pricedJob.account,
          },
          {
            populate: ["tenant"],
          },
        );

        if (!account) {
          logger.warn(
            { biJobIndex: pricedJob.biJobIndex },
            "Account %s is not found. Don't charge the job.",
            pricedJob.account,
          );
        }

        const comment = parsePlaceholder(misConfig.jobChargeComment, pricedJob);

        const metadataMap: ChargeRecord["metadata"] = {};
        const savedFields = misConfig.jobChargeMetadata?.savedFields;
        savedFields?.forEach((field) => {
          metadataMap[field] = pricedJob[field];
        });

        const existingRunningRecord = await em.findOne(RunningJobChargeRecord, {
          cluster: job.cluster,
          jobId: job.jobId,
        });

        if (account) {
          // charge account
          await charge(
            {
              amount: existingRunningRecord
                ? pricedJob.accountPrice.minus(existingRunningRecord.accountPrice)
                : pricedJob.accountPrice,
              type: misConfig.jobChargeType,
              comment,
              target: account,
              userId: pricedJob.user,
              metadata: metadataMap,
            },
            em,
            currentActivatedClusters,
            logger,
            clusterPlugin,
          );

          // charge tenant
          await charge(
            {
              amount: existingRunningRecord
                ? pricedJob.tenantPrice.minus(existingRunningRecord.tenantPrice)
                : pricedJob.tenantPrice,
              type: misConfig.jobChargeType,
              comment,
              target: account.tenant.$,
              userId: pricedJob.user,
              metadata: metadataMap,
            },
            em,
            currentActivatedClusters,
            logger,
            clusterPlugin,
          );

          const ua = await em.findOne(
            UserAccount,
            {
              account: { accountName: pricedJob.account },
              user: { userId: pricedJob.user },
            },
            {
              populate: ["user", "account"],
              lockMode: LockMode.PESSIMISTIC_WRITE,
            },
          );

          if (!ua) {
            logger.warn(
              { biJobIndex: pricedJob.biJobIndex },
              "User %s in account %s is not found.",
              pricedJob.user,
              pricedJob.account,
            );
          } else {
            // 用户限额及相关操作
            const accountChargeAmount = existingRunningRecord
              ? pricedJob.accountPrice.minus(existingRunningRecord.accountPrice)
              : pricedJob.accountPrice;
            await addJobCharge(ua, accountChargeAmount, currentActivatedClusters, clusterPlugin, logger);
          }
        }

        // 删除进行中作业计费表中对应的记录
        if (existingRunningRecord) {
          await em.removeAndFlush(existingRunningRecord);
        }

        pricedJobs.push(pricedJob);
      }

      savedJobsInfo.push(...pricedJobs);
      return pricedJobs.map(toGrpc);
    });

    em.clear();

    await callHook(
      "jobsSaved",
      {
        jobs: result,
      },
      logger,
    );

    return result.length;
  };

  const clusters = await getActivatedClusters(em, logger);

  try {
    let newJobsCount = 0;

    const fields: string[] = [
      "job_id",
      "name",
      "user",
      "account",
      "cpus_alloc",
      "gpus_alloc",
      "mem_alloc_mb",
      "cpus_req",
      "mem_req_mb",
      "partition",
      "qos",
      "elapsed_seconds",
      "node_list",
      "nodes_req",
      "nodes_alloc",
      "time_limit_minutes",
      "submit_time",
      "start_time",
      "end_time",
    ];

    for (const cluster of Object.keys(clusters)) {
      logger.info(`fetch jobs from cluster ${cluster}`);
      const endFetchDate = new Date(Date.now() - misConfig.fetchJobs.endTimeDelaySeconds * 1000);

      // 1、同步正在进行中的作业及在当期时间点之后结束的作业
      const clusterConfig = clusters[cluster];
      const runningJobsResponse = await clusterPlugin.clusters.callOnOne(cluster, logger, async (client) =>
        await getSchedulerAdapterJobsByClusterFeatures(client, clusterConfig, {
          fields,
          filter: {
            users: [],
            accounts: [],
            states: ["RUNNING", "PENDING", ...(clusterConfig.ai.enabled ? ["QUEUED"] : [])],
          },
        }),
      );

      const endedJobsAfterEndFetchDate = await clusterPlugin.clusters.callOnOne(cluster, logger, async (client) =>
        await getSchedulerAdapterJobsByClusterFeatures(client, clusterConfig, {
          fields,
          filter: {
            users: [],
            accounts: [],
            states: [],
            // 结束时间在当前时间节点之后
            endTime: { startTime: new Date(endFetchDate.getTime() + 1000).toISOString() },
          },
        }),
      );

      // 对每个正在进行中的作业及在当期时间点之后结束的作业进行计费处理
      const runningJobs = [...runningJobsResponse.jobs, ...endedJobsAfterEndFetchDate.jobs];
      for (let i = 0; i < runningJobs.length; i++) {
        try {
          await processRunningJobBilling(
            em,
            logger,
            clusterPlugin,
            cluster,
            currentActivatedClusters,
            runningJobs[i],
            endFetchDate,
            priceMap,
          );
        } catch (error) {
          logger.error(
            "Error processing running job billing. cluster: %s, jobId: %s, error: %o",
            cluster,
            runningJobs[i].jobId,
            error,
          );
        }
        // 隔一段时间清一次以防内存过大
        if (i % 100 === 0) {
          em.clear();
        }
      }

      // 2、同步已经结束的作业
      const latestDate = await getClusterLatestDate(em, cluster, logger);
      const nextDate = latestDate && new Date(latestDate.getTime() + 1000);
      const configDate: Date | undefined = (misConfig.fetchJobs.startDate && new Date(misConfig.fetchJobs.startDate)) as
        | Date
        | undefined;

      const startFetchDate =
        nextDate && configDate ? (nextDate > configDate ? nextDate : configDate) : nextDate || configDate;
      logger.info(`Fetching new info which end_time is from
          ${startFetchDate?.toISOString()} to ${endFetchDate.toISOString()}`);

      const fetchEndedJobWithinTimeRange = async (startDate: Date, endDate: Date, batchSize: number) => {
        // calculate totalCount between startDate and endDate
        const totalCount = await clusterPlugin.clusters.callOnOne(cluster, logger, async (client) =>
          await getSchedulerAdapterJobsByClusterFeatures(client, clusterConfig, {
            fields,
            filter: {
              users: [],
              accounts: [],
              states: [],
              endTime: { startTime: startDate?.toISOString(), endTime: endDate.toISOString() },
            },
            pageInfo: { page: 1, pageSize: 1 },
          }),
        )
          .then((result) => result.totalCount!);

        if (totalCount <= batchSize) {
          const jobsInfo = await clusterPlugin.clusters.callOnOne(cluster, logger, async (client) =>
            await getSchedulerAdapterJobsByClusterFeatures(client, clusterConfig, {
              fields,
              filter: {
                users: [],
                accounts: [],
                states: [],
                endTime: { startTime: startDate?.toISOString(), endTime: endDate.toISOString() },
              },
            }),
          )
            .then((result) => processGetJobsResult(cluster, result));

          let currentJobsGroup: ({ cluster: string } & ClusterJobInfo)[] = [];
          let previousDate: string | null = null;
          let savedJobsCount = 0;

          for (const job of jobsInfo) {
            if (job.endTime === previousDate) {
              currentJobsGroup.push(job);
            } else {
              savedJobsCount += await persistJobAndCharge(currentJobsGroup);
              currentJobsGroup = [job];
            }
            previousDate = job.endTime!;
          }

          // process last group
          if (currentJobsGroup.length > 0) {
            savedJobsCount += await persistJobAndCharge(currentJobsGroup);
          }

          logger.info(`Completed. Saved ${savedJobsCount} new info.`);
          lastFetched = new Date();
          return savedJobsCount;
        } else {
          const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
          const firstHalfJobsCount = await fetchEndedJobWithinTimeRange(startDate, midDate, batchSize);
          const secondHalfJobsCount = await fetchEndedJobWithinTimeRange(
            new Date(midDate.getTime() + 1000),
            endDate,
            batchSize,
          );
          return firstHalfJobsCount + secondHalfJobsCount;
        }
      };

      newJobsCount += await fetchEndedJobWithinTimeRange(
        startFetchDate ?? new Date(0),
        endFetchDate,
        misConfig.fetchJobs.batchSize,
      );
    }

    const messages: Message[] = savedJobsInfo.map((job) => ({
      messageType: InternalMessageType.JobFinished,
      targetType: TargetType.USER,
      targetIds: [job.user],
      metadata: {
        time: job.timeEnd.toISOString(),
        jobId: job.idJob.toString(),
        jobName: job.jobName,
        cluster: job.cluster,
        account: job.account,
        price: job.accountPrice.toString() ?? "0",
      },
    }));

    await batchSendMessages(messages, logger); // 发送当前批次的消息

    return { newJobsCount };
  } catch (e) {
    logger.error("Error when fetching jobs. %o", e);
    throw e;
  }
}

async function processRunningJobBilling(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin,
  cluster: string,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  runningJob: ClusterJobInfo,
  endFetchDate: Date,
  priceMap: PriceMap,
) {
  await em.transactional(async (em) => {
    const placeholderData = {
      ...runningJob,
      cluster,
      idJob: runningJob.jobId,
      timeUsed: Math.max(0, Number(runningJob.elapsedSeconds) || 0),
    };

    // 查找是否已存在此作业的计费记录
    const existingRunningRecord = await em.findOne(
      RunningJobChargeRecord,
      {
        cluster,
        jobId: runningJob.jobId,
      },
      {
        lockMode: LockMode.PESSIMISTIC_WRITE,
      },
    );

    const accountName = runningJob.account;
    const userId = runningJob.user;
    const account = await em.findOne(
      Account,
      {
        accountName: runningJob.account,
      },
      {
        populate: ["tenant"],
      },
    );

    if (!account) {
      logger.error(
        { biJobIndex: runningJob.jobId },
        "Account %s is not found. Don't charge the job.",
        runningJob.account,
      );
      return;
    }

    const tenantName = account.tenant.$.name;
    const submitTime = runningJob.submitTime ? new Date(runningJob.submitTime) : new Date();

    const minInterval = misConfig.fetchJobs.runningJobBillingMinDurationHours * 60 * 60 * 1000;

    const metadataMap: ChargeRecord["metadata"] = {};
    const savedFields = misConfig.jobChargeMetadata?.savedFields;
    savedFields?.forEach((field) => {
      metadataMap[field] = placeholderData[field];
    });

    // 运行中的作业计费表已经存在记录的情况
    if (existingRunningRecord) {
      // 1. 检查距离上一次计费时间是否小于最小计费间隔，如果小于则跳过
      const timeDiff = endFetchDate.getTime() - existingRunningRecord.lastChargeTime.getTime();

      if (timeDiff < minInterval) {
        return;
      }

      // 2. 计算费用
      const price = tenantName
        ? await priceMap.calculatePrice({
            jobId: runningJob.jobId,
            cluster: cluster,
            cpusAlloc: runningJob.cpusAlloc || 0,
            gpu: runningJob.gpusAlloc || 0,
            memAlloc: runningJob.memAllocMb || 0,
            memReq: runningJob.memReqMb,
            partition: runningJob.partition,
            qos: runningJob.qos,
            timeUsed: Math.max(0, Number(runningJob.elapsedSeconds) || 0),
            account: accountName,
            tenant: tenantName,
            submitTime,
          })
        : emptyJobPriceInfo();

      const accountPriceSum = price.account?.price || new Decimal(0);
      const tenantPriceSum = price.tenant?.price || new Decimal(0);

      // 此次扣费金额
      const accountPrice = accountPriceSum.minus(existingRunningRecord.accountPrice);
      const tenantPrice = tenantPriceSum.minus(existingRunningRecord.tenantPrice);

      // 若本次增量为0，跳过扣费记录，但更新时间戳以免重复检查
      if (accountPrice.isZero() && tenantPrice.isZero()) {
        existingRunningRecord.lastChargeTime = endFetchDate;
        existingRunningRecord.accountPrice = accountPriceSum;
        existingRunningRecord.tenantPrice = tenantPriceSum;
        em.persist(existingRunningRecord);
        return;
      }

      // 3. 产生扣费记录
      // 生成账户扣费记录
      await charge(
        {
          amount: accountPrice,
          type: misConfig.jobChargeType,
          comment: parsePlaceholder(misConfig.jobChargeComment, placeholderData),
          target: account,
          userId: userId,
          metadata: metadataMap,
        },
        em,
        currentActivatedClusters,
        logger,
        clusterPlugin,
      );

      // 生成租户扣费记录
      await charge(
        {
          amount: tenantPrice,
          type: misConfig.jobChargeType,
          comment: parsePlaceholder(misConfig.jobChargeComment, placeholderData),
          target: account.tenant.$,
          userId: userId,
          metadata: metadataMap,
        },
        em,
        currentActivatedClusters,
        logger,
        clusterPlugin,
      );

      const ua = await em.findOne(
        UserAccount,
        {
          account: { accountName },
          user: { userId },
        },
        {
          populate: ["user", "account"],
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );
      if (ua) {
        await addJobCharge(ua, accountPrice, currentActivatedClusters, clusterPlugin, logger);
      }

      // 4. 更新进行中作业计费表
      existingRunningRecord.accountPrice = accountPriceSum;
      existingRunningRecord.tenantPrice = tenantPriceSum;
      existingRunningRecord.lastChargeTime = endFetchDate;
      em.persist(existingRunningRecord);
      return;
    }

    // 不存在记录的情况
    // 1. 检查作业提交时间距离当前时间是否小于最小计费周期，是则跳过
    const timeDiff = endFetchDate.getTime() - submitTime.getTime();

    if (timeDiff < minInterval) {
      return;
    }

    // 2. 计算费用（基于提交时间计算适用的计费项）
    const price = tenantName
      ? await priceMap.calculatePrice({
          jobId: runningJob.jobId,
          cluster: cluster,
          cpusAlloc: runningJob.cpusAlloc || 0,
          gpu: runningJob.gpusAlloc || 0,
          memAlloc: runningJob.memAllocMb || 0,
          memReq: runningJob.memReqMb,
          partition: runningJob.partition,
          qos: runningJob.qos,
          timeUsed: runningJob.elapsedSeconds !== undefined ? runningJob.elapsedSeconds : 0,
          account: accountName,
          tenant: tenantName,
          submitTime,
        })
      : emptyJobPriceInfo();

    const accountPrice = price.account?.price || new Decimal(0);
    const tenantPrice = price.tenant?.price || new Decimal(0);
    const accountBillingItemId = price.account?.billingItemId || "UNKNOWN";
    const tenantBillingItemId = price.tenant?.billingItemId || "UNKNOWN";

    const newRecord = new RunningJobChargeRecord({
      cluster,
      jobId: runningJob.jobId,
      startTime: submitTime,
      accountBillingItemId,
      tenantBillingItemId,
      accountPrice,
      tenantPrice,
      lastChargeTime: endFetchDate,
    });

    // 零金额时不产生扣费记录，直接持久化到进行中作业计费表后返回
    if (accountPrice.isZero() && tenantPrice.isZero()) {
      em.persist(newRecord);
      return;
    }

    // 3. 产生扣费记录
    // 生成账户扣费记录
    await charge(
      {
        amount: accountPrice,
        type: misConfig.jobChargeType,
        comment: parsePlaceholder(misConfig.jobChargeComment, placeholderData),
        target: account,
        userId: userId,
        metadata: metadataMap,
      },
      em,
      currentActivatedClusters,
      logger,
      clusterPlugin,
    );

    // 生成租户扣费记录
    await charge(
      {
        amount: tenantPrice,
        type: misConfig.jobChargeType,
        comment: parsePlaceholder(misConfig.jobChargeComment, placeholderData),
        target: account.tenant.$,
        userId: userId,
        metadata: metadataMap,
      },
      em,
      currentActivatedClusters,
      logger,
      clusterPlugin,
    );

    const ua = await em.findOne(
      UserAccount,
      {
        account: { accountName },
        user: { userId },
      },
      {
        populate: ["user", "account"],
        lockMode: LockMode.PESSIMISTIC_WRITE,
      },
    );
    if (ua) {
      await addJobCharge(ua, accountPrice, currentActivatedClusters, clusterPlugin, logger);
    }

    // 4. 持久化到进行中作业计费表
    em.persist(newRecord);
  });
}
