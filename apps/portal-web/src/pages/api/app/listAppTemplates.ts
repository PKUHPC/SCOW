import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { AppTemplateServiceClient } from "@scow/protos/build/server/app_template";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getMisClient } from "src/utils/misClient";
import { route } from "src/utils/route";

export const AppTemplateDetail = Type.Object({
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
  appId: Type.String(),
  customAttributes: Type.Optional(Type.String()),
  createdAt: Type.String(),
});

export type AppTemplateDetail = Static<typeof AppTemplateDetail>;

export const ListAppTemplatesSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    appId: Type.String(),
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(AppTemplateDetail),
    }),
  },
});

const auth = authenticate(() => true);

export default route(ListAppTemplatesSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { appId, cluster } = req.query;

  const client = getMisClient(AppTemplateServiceClient);

  const reply = await asyncUnaryCall(client, "listAppTemplates", {
    userId: info.identityId,
    appId,
    cluster,
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
        appId: t.appId,
        customAttributes: t.customAttributes ?? undefined,
        createdAt: t.createdAt ?? new Date().toISOString(),
      })),
    },
  };
});
