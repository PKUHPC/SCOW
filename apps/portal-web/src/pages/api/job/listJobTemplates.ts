import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { JobTemplateServiceClient } from "@scow/protos/build/server/job_template";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getMisClient } from "src/utils/misClient";
import { route } from "src/utils/route";

export const JobTemplateDetail = Type.Object({
  id: Type.Number(),
  templateName: Type.String(),
  cluster: Type.String(),
  account: Type.String(),
  partition: Type.String(),
  qos: Type.String(),
  nodeCount: Type.Number(),
  coreCount: Type.Number(),
  gpuCount: Type.Number(),
  maxTime: Type.Number(),
  maxTimeUnit: Type.Number(),
  memoryMb: Type.Optional(Type.Number()),
  command: Type.Optional(Type.String()),
  createdAt: Type.String(),
});

export type JobTemplateDetail = Static<typeof JobTemplateDetail>;

export const ListJobTemplatesSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({}),

  responses: {
    200: Type.Object({
      results: Type.Array(JobTemplateDetail),
    }),
  },
});

const auth = authenticate(() => true);

export default route(ListJobTemplatesSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getMisClient(JobTemplateServiceClient);

  const reply = await asyncUnaryCall(client, "listJobTemplates", {
    userId: info.identityId,
  });

  return {
    200: {
      results: reply.templates.map((t) => ({
        id: t.id,
        templateName: t.templateName,
        cluster: t.cluster,
        account: t.account,
        partition: t.partition,
        qos: t.qos,
        nodeCount: t.nodeCount,
        coreCount: t.coreCount,
        gpuCount: t.gpuCount,
        maxTime: t.maxTime,
        maxTimeUnit: t.maxTimeUnit,
        memoryMb: t.memoryMb ?? undefined,
        command: t.command ?? undefined,
        createdAt: t.createdAt ?? new Date().toISOString(),
      })),
    },
  };
});
