import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { parseTime } from "@scow/lib-web/build/utils/datetime";
import { RunningJob } from "@scow/protos/build/common/job";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/User";
import { getClient } from "src/utils/client";

type JobAccessible = "OK" | "NotFound" | "NotAllowed" | "LimitNotValid";

interface Result {
  job: RunningJob;
  jobAccessible: JobAccessible;
}

type ActionType = "cancelJob" | "changeJobLimit" | "queryJobLimit";

interface Props {
  actionType: ActionType;
  jobId: string;
  cluster: string;
  info: UserInfo;
  limitMinutes?: number;
  allowUserAndAccountAdminChangeJobTimeLimit?: boolean;
}

export async function checkJobAccessible({
  actionType,
  jobId,
  cluster,
  info,
  limitMinutes,
  allowUserAndAccountAdminChangeJobTimeLimit = true,
}: Props): Promise<Result> {
  const client = getClient(JobServiceClient);

  const result: Result = {} as Result;

  const reply = await asyncClientCall(client, "getRunningJobs", {
    cluster,
    jobIdList: [jobId],
  });

  if (reply.jobs.length === 0) {
    result.jobAccessible = "NotFound";
    result.job = {} as RunningJob;
    return result;
  }

  const job = reply.jobs[0];
  result.job = job;

  // 如果设置的作业时限比该作业运行时间小， 则该作业不可以修改作业时限
  if (!!limitMinutes && limitMinutes * 60 * 1000 < parseTime(job.runningTime)) {
    result.jobAccessible = "LimitNotValid";
    return result;
  }

  if (info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
    result.jobAccessible = "OK";
    return result;
  }
  // 用户发起了这个作业
  // 如果是取消作业和查询作业时限，返回"OK"
  // changeJobLimit 时 allowUserAndAccountAdminChangeJobTimeLimit 为true时返回"OK"
  if (job.user === info.identityId && (actionType !== "changeJobLimit" || allowUserAndAccountAdminChangeJobTimeLimit)) {
    result.jobAccessible = "OK";
    return result;
  }

  // 用户是这个作业的账户的管理员或者拥有者
  // changeJobLimit 时 allowUserAndAccountAdminChangeJobTimeLimit 为true时返回"OK"
  if (
    info.accountAffiliations.some((x) => x.accountName === job.account && x.role !== UserRole.USER) &&
    (actionType !== "changeJobLimit" || allowUserAndAccountAdminChangeJobTimeLimit)
  ) {
    result.jobAccessible = "OK";
    return result;
  }

  // 如果用户是租户的管理员，而且这个作业的账户属于这个租户
  if (info.tenantRoles.includes(TenantRole.TENANT_ADMIN)) {
    const { results } = await asyncClientCall(getClient(AccountServiceClient), "getAccounts", {
      accountName: job.account,
      tenantName: info.tenant,
    });

    result.jobAccessible = results.length === 0 ? "NotAllowed" : "OK";

    return result;
  }

  result.jobAccessible = "NotAllowed";
  return result;
}
