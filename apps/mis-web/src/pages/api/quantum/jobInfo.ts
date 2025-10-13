import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import {
  GetQuantumJobsRequest, GetQuantumJobsRequest_SortBy as SortBy,
  QuantumJobFilter, QuantumServiceClient,
} from "@scow/protos/build/server/quantum";
import {
  quantumJobStateToJSON,
} from "@scow/protos/build/server/quantum";
import { Static, Type } from "@sinclair/typebox";
import { getTokenFromCookie } from "src/auth/cookie";
import { authenticate } from "src/auth/server";
import { JobSortOrder } from "src/models/job";
import { JobSortBy } from "src/models/quantumJob";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const mapJobSortByType = {
  "jobId": SortBy.JOB_ID,
  "account": SortBy.ACCOUNT,
  "user": SortBy.USER,
  "submitTime": SortBy.SUBMIT_TIME,
  "lastSyncTime": SortBy.LAST_SYNC_TIME,
  "qits": SortBy.QITS,
  "amount": SortBy.AMOUNT,
  // "duration": SortBy.DURATION,
  "shots": SortBy.SHOTS,
  "device": SortBy.DEVICE,
  "qubits": SortBy.QUBITS,
  "state": SortBy.STATE,
} as Record<string, SortBy>;

export const mapJobSortOrderType = {
  "descend": SortOrder.DESCEND,
  "ascend": SortOrder.ASCEND,
} as Record<string, SortOrder>;

export const GetJobFilter = Type.Object({
  jobId: Type.Optional(Type.Integer({ minimum: 0 })),
  userId: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),
  qubits: Type.Optional(Type.Integer()),
  shots: Type.Optional(Type.Integer()),
});
export type GetJobFilter = Static<typeof GetJobFilter>;

export const JobInfo = Type.Object({
  jobId: Type.Number(),
  account: Type.String(),
  user: Type.String(),
  submitTime: Type.String(),
  lastSyncTime: Type.Optional(Type.String()),
  qits: Type.Optional(Type.String()),
  amount: Type.Optional(Type.String()),
  duration: Type.Number(),
  shots: Type.Number(),
  device: Type.String(),
  qubits: Type.Optional(Type.Number()),
  state: Type.String(),
});

export const GetJobsResponse = Type.Object({
  totalCount: Type.Number(),
  jobs: Type.Array(JobInfo),
});
export type GetJobsResponse = Static<typeof GetJobsResponse>;

export const GetQuantumJobInfoSchema = typeboxRouteSchema({

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

export const getQuantumJobInfo = async (request: GetQuantumJobsRequest) => {

  const client = getClient(QuantumServiceClient);

  return await asyncClientCall(client, "getQuantumJobs", request);
};


export default /* #__PURE__*/route(GetQuantumJobInfoSchema, async (req, res) => {
  const auth = authenticate((u) =>
    u.tenantRoles.includes(TenantRole.TENANT_ADMIN) || u.accountAffiliations.length > 0);

  const info = await auth(req, res);
  const userToken = getTokenFromCookie({ req });

  if (!info || !userToken) { return; }

  const { page = 1, accountName, userId, jobId, pageSize, sortBy, sortOrder, qubits, shots } = req.query;

  const filter: QuantumJobFilter = {
    tenantName: info.tenant,
    accountName,
    jobId,
    qubits,
    shots,
    userId,
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

  try {

    const { totalCount, jobs } = await getQuantumJobInfo({
      userToken,
      filter,
      page,
      pageSize,
      ...(sortBy && sortOrder && {
        sortBy: mapJobSortByType[sortBy],
        sortOrder: mapJobSortOrderType[sortOrder],
      }),
    });

    const result = {
      totalCount,
      jobs: jobs.map((job) => ({
        ...job,
        state: quantumJobStateToJSON(job.state),
      })),
    };

    return {
      200: result,
    };

  } catch (e) {
    console.error("get job info error", e);
    return {
      500: { message: "Internal server error" },
    };
  }

});


