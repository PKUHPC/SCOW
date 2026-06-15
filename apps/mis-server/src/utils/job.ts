import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { decimalToMoney } from "@scow/lib-decimal";
import { JobInfo } from "@scow/protos/build/common/ended_job";
import {
  JobsOfAccountAndUserTarget,
  JobsOfAccountTarget,
  JobsOfJobIdAndAccountTarget,
  JobsOfJobIdAndUserTarget,
  JobsOfJobIdsTarget,
  JobsOfJobIdTarget,
  JobsOfTenantTarget,
  JobsOfUserTarget,
} from "@scow/protos/build/server/job";
import { JobInfo as JobInfoEntity } from "src/entities/JobInfo";
import { UserRole } from "src/entities/UserAccount";

export function toGrpc(x: JobInfoEntity) {
  return {
    account: x.account,
    biJobIndex: x.biJobIndex,
    cluster: x.cluster,
    cpusAlloc: x.cpusAlloc,
    cpusReq: x.cpusReq,
    gpu: x.gpu,
    idJob: x.idJob,
    jobName: x.jobName,
    memAlloc: x.memAlloc,
    memReq: x.memReq,
    nodelist: x.nodelist,
    nodesAlloc: x.nodesAlloc,
    nodesReq: x.nodesReq,
    partition: x.partition,
    qos: x.qos,
    recordTime: x.recordTime.toISOString(),
    timeEnd: x.timeEnd.toISOString(),
    timeStart: x.timeStart ? x.timeStart.toISOString() : undefined,
    timeSubmit: x.timeSubmit.toISOString(),
    timeUsed: x.timeUsed,
    timeWait: x.timeWait,
    timelimit: x.timelimit,
    user: x.user,
    tenantPrice: decimalToMoney(x.tenantPrice),
    accountPrice: decimalToMoney(x.accountPrice),
  } as JobInfo;
}

export const getJobsTargetSearchParam = (
  target:
    | { $case: "jobsOfJobId"; jobsOfJobId: JobsOfJobIdTarget }
    | { $case: "jobsOfJobIds"; jobsOfJobIds: JobsOfJobIdsTarget }
    | { $case: "jobsOfJobIdAndUser"; jobsOfJobIdAndUser: JobsOfJobIdAndUserTarget }
    | { $case: "jobsOfJobIdAndAccount"; jobsOfJobIdAndAccount: JobsOfJobIdAndAccountTarget }
    | { $case: "jobsOfAccountAndUser"; jobsOfAccountAndUser: JobsOfAccountAndUserTarget }
    | { $case: "jobsOfAccount"; jobsOfAccount: JobsOfAccountTarget }
    | { $case: "jobsOfUser"; jobsOfUser: JobsOfUserTarget }
    | { $case: "jobsOfTenant"; jobsOfTenant: JobsOfTenantTarget },
): {
  tenant: string;
  account?: string | { $ne: null };
  user?: string | { $ne: null };
  idJob?: number | number[] | { $ne: null };
} => {
  const { accountName, tenantName, userId, jobId, jobIds } = target[target.$case];

  let searchParam: {
    tenant: string;
    account?: string | { $ne: null };
    user?: string | { $ne: null };
    idJob?: number | number[] | { $ne: null };
  } = { tenant: tenantName };

  let jobIdQueryValue: number | number[] | { $ne: null } | undefined;
  if (jobIds && jobIds.length > 0) {
    jobIdQueryValue = jobIds; // 批量查询使用数组
  } else if (jobId) {
    jobIdQueryValue = jobId; // 单个查询使用 number
  }

  switch (target?.$case) {
    case "jobsOfJobId":
      searchParam = { tenant: tenantName, idJob: jobIdQueryValue };
      break;
    case "jobsOfJobIds":
      searchParam = { tenant: tenantName, idJob: jobIdQueryValue };
      break;
    case "jobsOfJobIdAndUser":
      searchParam = { tenant: tenantName, idJob: jobIdQueryValue, user: userId };
      break;
    case "jobsOfJobIdAndAccount":
      searchParam = { tenant: tenantName, idJob: jobIdQueryValue, account: accountName };
      break;
    case "jobsOfAccountAndUser":
      searchParam = { tenant: tenantName, account: accountName, user: userId };
      break;
    case "jobsOfAccount": {
      searchParam = { tenant: tenantName, account: accountName };
      break;
    }
    case "jobsOfUser": {
      searchParam = { tenant: tenantName, user: userId };
      break;
    }
    case "jobsOfTenant": {
      break;
    }
    default:
      break;
  }
  return searchParam;
};

interface JobUserAndAccountOwnerDetails {
  biJobIndex: number;
  userName: string | null;
  accountOwnerId: string | null;
  accountOwnerName: string | null;
}

export type JobUserAndAccountOwnerDetailsMap = Record<number, JobUserAndAccountOwnerDetails>;
/**
 * 使用knex进行关联查询，获取作业ID对应的用户姓名、账户主管理员ID和姓名
 *
 * @param em EntityManager实例
 * @param jobIds 作业ID列表
 * @returns 以作业id为key，属性中包含用户名、账户主管理员ID、账户主管理员姓名的对象
 */
export async function getJobUserAndAccountOwnerDetailsMap(
  em: SqlEntityManager<MySqlDriver>,
  jobIds: number[],
): Promise<JobUserAndAccountOwnerDetailsMap> {
  if (jobIds.length === 0) {
    return {};
  }

  const knex = em.getConnection().getKnex();

  const jobUserAndAccountOwnerDetails = await knex
    .from({ j: "job_info" })
    .select([
      "j.bi_job_index as biJobIndex",
      "u.name as userName",
      "ou.user_id as accountOwnerId",
      "ou.name as accountOwnerName",
    ])
    .leftJoin({ u: "user" }, "u.user_id", "j.user")
    .leftJoin({ a: "account" }, "a.account_name", "j.account")
    .leftJoin({ ua: "user_account" }, function () {
      this.on("ua.account_id", "=", "a.id").andOn("ua.role", "=", knex.raw("?", [UserRole.OWNER]));
    })
    .leftJoin({ ou: "user" }, "ou.id", "ua.user_id")
    .whereIn("j.bi_job_index", jobIds);

  return jobUserAndAccountOwnerDetails.reduce((map, detail) => {
    map[detail.biJobIndex] = detail;
    return map;
  }, {} as JobUserAndAccountOwnerDetailsMap);
}
