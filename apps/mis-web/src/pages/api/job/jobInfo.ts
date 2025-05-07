import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { GetJobsRequest, GetJobsRequest_SortBy as SortBy, JobFilter, JobServiceClient, JobsOfAccountAndUserTarget,
  JobsOfAccountTarget, JobsOfJobIdAndAccountTarget,
  JobsOfJobIdAndUserTarget, JobsOfJobIdTarget, JobsOfTenantTarget, JobsOfUserTarget,
} from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { JobSortBy, JobSortOrder } from "src/models/job";
import { TenantRole } from "src/models/User";
import { Money } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const mapJobSortByType = {
  "idJob":SortBy.ID_JOB,
  "account":SortBy.ACCOUNT,
  "cluster":SortBy.CLUSTER,
  "jobName":SortBy.JOB_NAME,
  "partition":SortBy.PARTITION,
  "price":SortBy.PRICE,
  "qos":SortBy.QOS,
  "timeEnd":SortBy.TIME_END,
  "timeSubmit":SortBy.TIME_SUBMIT,
  "user":SortBy.USER,
} as Record<string, SortBy>;

export const mapJobSortOrderType = {
  "descend":SortOrder.DESCEND,
  "ascend":SortOrder.ASCEND,
} as Record<string, SortOrder>;

export const GetJobFilter = Type.Object({

  /**
   * @format date-time
   */
  jobEndTimeStart: Type.Optional(Type.String({ format: "date-time" })),

  /**
   * @format date-time
   */
  jobEndTimeEnd: Type.Optional(Type.String({ format: "date-time" })),
  /**
   * @minimum 1
   * @type integer
   */
  jobId: Type.Optional(Type.Integer({ minimum: 1 })),

  /**
    如果是平台管理员，或者userId是自己，或者（设置了accountName，而且当前用户是accountName账户的管理员或者拥有者），那么
      显示userId用户在accountName中的作业
    否则：403
    */
  userId: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),

  clusters: Type.Optional(Type.Array(Type.String())),
});
export type GetJobFilter = Static<typeof GetJobFilter>;

// Cannot use JobInfo from protos
export const JobInfo = Type.Object({
  biJobIndex: Type.Number(),
  idJob: Type.Number(),
  account: Type.String(),
  user: Type.String(),
  partition: Type.String(),
  nodelist: Type.String(),
  jobName: Type.String(),
  cluster: Type.String(),
  timeSubmit: Type.Optional(Type.String()),
  timeStart: Type.Optional(Type.String()),
  timeEnd: Type.Optional(Type.String()),
  gpu: Type.Number(),
  cpusReq:Type.Number(),
  memReq: Type.Number(),
  nodesReq: Type.Number(),
  cpusAlloc: Type.Number(),
  memAlloc: Type.Number(),
  nodesAlloc: Type.Number(),
  timelimit: Type.Number(),
  timeUsed: Type.Number(),
  timeWait: Type.Number(),
  qos: Type.String(),
  recordTime: Type.Optional(Type.String()),
  accountPrice: Type.Optional(Money),
  tenantPrice: Type.Optional(Money),
});
export type JobInfo = Static<typeof JobInfo>;

export const GetJobsResponse = Type.Object({
  totalCount: Type.Number(),
  jobs: Type.Array(JobInfo),
  totalAccountPrice: Type.Optional(Money),
  totalTenantPrice: Type.Optional(Money),
});
export type GetJobsResponse = Static<typeof GetJobsResponse>;

export const GetJobInfoSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({
    ...GetJobFilter.properties,
    /**
     * @minimum 1
     * @type integer
     */
    page: Type.Optional(Type.Integer({ minimum: 1 })),

    /**
     * @type integer
     */
    pageSize: Type.Optional(Type.Integer()),

    sortBy: Type.Optional(JobSortBy),

    sortOrder: Type.Optional(JobSortOrder),
  }),

  responses: {
    200: GetJobsResponse,

    403: Type.Null(),
  },
});

export const getJobInfo = async (request: GetJobsRequest) => {

  const client = getClient(JobServiceClient);

  return await asyncClientCall(client, "getJobs", request);
};


export default /* #__PURE__*/route(GetJobInfoSchema, async (req, res) => {
  const auth = authenticate((u) =>
    u.tenantRoles.includes(TenantRole.TENANT_ADMIN) || u.accountAffiliations.length > 0);

  const info = await auth(req, res);

  if (!info) { return; }

  const { page = 1, accountName, userId, jobEndTimeEnd, jobEndTimeStart, jobId, clusters, pageSize, sortBy, sortOrder }
  = req.query;

  const filter: JobFilter = {
    tenantName: info.tenant,
    accountName,
    jobEndTimeEnd,
    jobEndTimeStart,
    jobId,
    jobIds: [],
    biJobIndexs: [],
    clusters: clusters ?? [],
  };

  if (
    info.tenantRoles.includes(TenantRole.TENANT_ADMIN)
    || userId === info.identityId
    || (accountName && info.accountAffiliations.find((x) => x.accountName === accountName))
  ) {
    filter.userId = userId;
    filter.accountName = accountName;
  } else {
    return { 403: null };
  }

  // 默认按照作业结束时间的降序排列
  const mapJobSortBy = sortBy ? mapJobSortByType[sortBy] : mapJobSortByType.timeEnd;
  const mapJobSortOrder = sortOrder ? mapJobSortOrderType[sortOrder] : mapJobSortOrderType.descend;

  const result = await getJobInfo({
    filter,
    page,
    pageSize,
    sortBy:mapJobSortBy,
    sortOrder:mapJobSortOrder,
  });

  return {
    200: result,
  };
});

export const buildJobsRequestTarget = (
  tenantName: string,
  jobId?: number,
  accountName?: string,
  userId?: string,
):
  | { $case: "jobsOfAccount"; jobsOfAccount: JobsOfAccountTarget }
  | { $case: "jobsOfUser"; jobsOfUser: JobsOfUserTarget }
  | { $case: "jobsOfAccountAndUser"; jobsOfAccountAndUser: JobsOfAccountAndUserTarget }
  | { $case: "jobsOfTenant"; jobsOfTenant: JobsOfTenantTarget }
  | { $case: "jobsOfJobId"; jobsOfJobId: JobsOfJobIdTarget }
  | { $case: "jobsOfJobIdAndUser"; jobsOfJobIdAndUser: JobsOfJobIdAndUserTarget }
  | { $case: "jobsOfJobIdAndAccount"; jobsOfJobIdAndAccount: JobsOfJobIdAndAccountTarget } => {

  return jobId && userId
    ? { $case: "jobsOfJobIdAndUser", jobsOfJobIdAndUser: { jobId, userId, tenantName } }
    : jobId && accountName
      ? { $case: "jobsOfJobIdAndAccount", jobsOfJobIdAndAccount: { jobId, accountName, tenantName } }
      : jobId
        ? { $case: "jobsOfJobId", jobsOfJobId: { jobId, tenantName } }
        : accountName && userId
          ? { $case: "jobsOfAccountAndUser", jobsOfAccountAndUser: { accountName, userId, tenantName } }
          : accountName
            ? { $case: "jobsOfAccount", jobsOfAccount: { accountName, tenantName } }
            : userId
              ? { $case: "jobsOfUser", jobsOfUser: { userId, tenantName } }
              : { $case: "jobsOfTenant", jobsOfTenant: { tenantName } };
};

