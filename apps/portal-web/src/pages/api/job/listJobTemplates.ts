import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use JobTemplateInfo from protos
export const JobTemplateInfo = Type.Object({
  id: Type.String(),
  jobName: Type.String(),
  submitTime: Type.Optional(Type.String()),
  comment: Type.Optional(Type.String()),
  cluster: Type.Optional(Type.String()),
});

export type JobTemplateInfo = Static<typeof JobTemplateInfo>;
export const ListJobTemplatesSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusters: Type.Union([Type.String(), Type.Array(Type.String())]),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(JobTemplateInfo),
    }),

    400: Type.Object({
      message: Type.String(),
    }),

    404: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(ListJobTemplatesSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { clusters } = req.query;
  const clusterIds = Array.from(new Set(Array.isArray(clusters) ? clusters : [clusters]));

  const client = getClient(JobServiceClient);

  const settledReplies = await Promise.allSettled(
    clusterIds.map(async (cluster) => {
      const { results } = await asyncUnaryCall(client, "listJobTemplates", {
        userId: info.identityId,
        cluster,
      });
      // 当后端模板记录没有cluster字段时，回填当前查询集群，便于前端多集群场景区分
      return results.map((item) => ({ ...item, cluster: item.cluster ?? cluster }));
    }),
  );

  const mergedResults = settledReplies.flatMap((item) => (item.status === "fulfilled" ? item.value : []));

  const failedClusters = settledReplies
    .map((item, index) => (item.status === "rejected" ? clusterIds[index] : undefined))
    .filter((cluster): cluster is string => cluster !== undefined);

  if (failedClusters.length > 0) {
    console.warn(
      "[listJobTemplates] failed clusters: %s, failed count: %d",
      failedClusters.join(","),
      failedClusters.length,
    );
  }

  return { 200: { results: mergedResults } };
});
