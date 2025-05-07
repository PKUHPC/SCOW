import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { JobInfo } from "src/pages/api/job/jobInfo";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const GetJobByBiJobIndexSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    biJobIndex: Type.String(),
  }),

  responses: {
    200: Type.Object({ info: JobInfo }),
    /** 作业未找到 */
    404: Type.Null(),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(GetJobByBiJobIndexSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { biJobIndex } = req.query;

    const client = getClient(JobServiceClient);

    return await asyncClientCall(client, "getJobByBiJobIndex", {
      biJobIndex,
    })
      .then(({ info }) => info ? ({ 200: { info } }) : ({ 404: null }))
      .catch(handlegRPCError({
        [Status.NOT_FOUND]: () => ({ 404: null }),
      }));
  });
