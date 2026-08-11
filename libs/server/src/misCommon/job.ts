import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import { JobField, JobFilter, JobServiceClient } from "@scow/protos/build/server/job";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Logger } from "ts-log";

import { getClientFn } from "../api";

// 查询 MIS 历史作业时默认单次响应条数。nodelist 等变长字段较大时，调用方应进一步调小。
export const DEFAULT_FILTER_JOBS_PAGE_SIZE = 5000;
// 轻量的 idJob + timeSubmit 查询使用的单次响应条数。
const DEFAULT_FILTER_LIGHTWEIGHT_JOBS_LIMIT = 10000;
// pageSize 对应 protobuf uint32，暂不设置额外的业务上限。
export const MAX_UINT32 = 0xffff_ffff;

type JobFilterInput = Omit<JobFilter, "clusters" | "jobIds" | "biJobIndexs"> &
  Partial<Pick<JobFilter, "clusters" | "jobIds" | "biJobIndexs">>;

/**
 * 按指定字段查询 MIS 历史作业，并统一处理请求分组和游标分页。
 * 注意需要查询可能更新的字段时不要使用游标分页查询，要限制查询数量确保一次事务中查询所有
 * 返回值会将全部分页结果汇总到同一个数组；查询未知总量时，调用方需要评估结果集的内存占用。
 *
 * 使用方式：
 * - 已知 jobIds 时按照 pageSize 拆分请求，每组仍通过游标读取完整结果。
 * - 未知结果数量时直接通过游标分页。
 * - pageSize 不传时统一使用默认值 5000；调用方可根据字段和结果规模显式调大或调小。
 */
export async function libGetMisJobsWithFields(
  client: JobServiceClient,
  params: {
    jobFilter: JobFilterInput;
    resultFields: JobField[];
    pageSize?: number;
    logger?: Logger;
  },
): Promise<JobInfo[]> {
  const { jobFilter, resultFields, pageSize, logger } = params;
  const normalizedPageSize = pageSize ?? DEFAULT_FILTER_JOBS_PAGE_SIZE;
  if (!Number.isInteger(normalizedPageSize) || normalizedPageSize <= 0 || normalizedPageSize > MAX_UINT32) {
    throw new ServiceError({
      code: status.INVALID_ARGUMENT,
      details: `pageSize must be an integer between 1 and ${MAX_UINT32}`,
    });
  }

  const normalizedFilter: JobFilter = {
    clusters: [],
    jobIds: [],
    biJobIndexs: [],
    ...jobFilter,
  };
  const hasKnownInputLength = normalizedFilter.jobIds.length > 0;
  logger?.info(
    "Query MIS jobs with fields: knownInputLength=%s, inputLength=%s, pageSize=%d.",
    hasKnownInputLength,
    hasKnownInputLength ? normalizedFilter.jobIds.length : "unknown",
    normalizedPageSize,
  );

  const jobIdGroups: number[][] = [];
  if (normalizedFilter.jobIds.length > 0) {
    for (let offset = 0; offset < normalizedFilter.jobIds.length; offset += normalizedPageSize) {
      jobIdGroups.push(normalizedFilter.jobIds.slice(offset, offset + normalizedPageSize));
    }
  } else {
    jobIdGroups.push(normalizedFilter.jobIds);
  }
  const jobs: JobInfo[] = [];

  // 已知 jobIds 时逐组查询；没有 jobIds 时只执行一组，并通过游标读取未知总量的结果。
  for (const jobIds of jobIdGroups) {
    let afterBiJobIndex: number | undefined;

    while (true) {
      const reply = await asyncClientCall(client, "getJobsWithFields", {
        jobFilter: { ...normalizedFilter, jobIds },
        resultFields,
        pageSize: normalizedPageSize,
        afterBiJobIndex,
      });
      jobs.push(...reply.jobs);

      if (reply.nextBiJobIndex === undefined) break;
      // 拒绝未递增的异常游标，避免错误的服务端响应导致无限循环。
      if (afterBiJobIndex !== undefined && reply.nextBiJobIndex <= afterBiJobIndex) {
        throw new ServiceError({
          code: status.INTERNAL,
          details: "getJobsWithFields returned a non-increasing next_bi_job_index",
        });
      }
      afterBiJobIndex = reply.nextBiJobIndex;
    }
  }

  logger?.info("Queried %d MIS jobs with fields after merging all pages.", jobs.length);
  return jobs;
}

// 查询 MIS 数据库中保存的作业信息的提交时间
export async function libGetMisHistoryJobSubmitTimes(
  logger: Logger,
  params: {
    cluster: string;
    userId: string;
    jobIds: number[];
  },
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<Map<number, string>> {
  if (!misServerUrl) {
    logger.trace("Mis is not deployed, skip fetching history job submit times from mis.");
    return new Map();
  }

  if (params.jobIds.length === 0) {
    logger.trace("No ended job ids need submit time fetched from mis.");
    return new Map();
  }

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(JobServiceClient);
  const userClient = getMisClient(UserServiceClient);
  const userInfo = await asyncClientCall(userClient, "getUserInfo", { userId: params.userId });

  const jobs = await libGetMisJobsWithFields(client, {
    jobFilter: {
      tenantName: userInfo.tenantName,
      // 调度器作业 ID 可能在不同集群中重复，因此此查询必须限制集群。
      clusters: [params.cluster],
      userId: params.userId,
      jobIds: params.jobIds,
    },
    // JOB_FIELD_ID_JOB 表示查询数据库中 id_job，含义为集群下的作业 ID。
    resultFields: [JobField.JOB_FIELD_ID_JOB, JobField.JOB_FIELD_TIME_SUBMIT],
    // idJob(uint32 最大值) 与带纳秒 timeSubmit 的实测 protobuf 响应约为每条 21 字节；
    // 10000 条约为 0.2 MiB，为默认 4 MiB gRPC 消息上限保留充足余量。
    pageSize: DEFAULT_FILTER_LIGHTWEIGHT_JOBS_LIMIT,
    logger,
  });

  const submitTimes = new Map<number, string>();
  jobs.forEach((job) => {
    if (job.timeSubmit !== undefined) {
      submitTimes.set(job.idJob, job.timeSubmit);
    }
  });

  logger.trace(
    "Fetched submit times of %d/%d ended jobs from mis in cluster %s.",
    submitTimes.size,
    params.jobIds.length,
    params.cluster,
  );

  return submitTimes;
}
