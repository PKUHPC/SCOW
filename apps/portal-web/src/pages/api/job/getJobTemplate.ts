import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { JobServiceClient, TimeUnit } from "@scow/protos/build/portal/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

// Cannot use JobTemplate from protos
export const JobTemplate = Type.Object({
  jobName: Type.String(),
  account: Type.String(),
  partition: Type.Optional(Type.String()),
  qos: Type.Optional(Type.String()),
  nodeCount: Type.Number(),
  coreCount: Type.Number(),
  gpuCount: Type.Optional(Type.Number()),
  maxTime: Type.Number(), // 最长运行时间
  command: Type.String(),
  comment: Type.Optional(Type.String()),
  maxTimeUnit: Type.Optional(Type.Enum(TimeUnit)), // 最长运行时间单位
});
export type JobTemplate = Static<typeof JobTemplate>;

export const GetJobTemplateSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    id: Type.String(),
  }),

  responses: {
    200: Type.Object({
      template: JobTemplate,
    }),

    400: Type.Object({
      message: Type.String(),
    }),

    404: Type.Object({ code: Type.Literal("TEMPLATE_NOT_FOUND") }),
  },
});

const auth = authenticate(() => true);

export default route(GetJobTemplateSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, id } = req.query;

  const client = getClient(JobServiceClient);

  return asyncUnaryCall(client, "getJobTemplate", {
    userId: info.identityId,
    cluster,
    templateId: id,
  }).then(
    ({ template }) => ({ 200: { template: template! } }),
    handlegRPCError({
      [status.NOT_FOUND]: () => ({ 404: { code: "TEMPLATE_NOT_FOUND" } as const }),
    }),
  );
});
