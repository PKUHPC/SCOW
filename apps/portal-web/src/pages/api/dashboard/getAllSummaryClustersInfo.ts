import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { ConfigServiceClient, SummaryPartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";
import { AccountState } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const PartitionInfo = Type.Object({
  partitionName: Type.String(),
  nodeCount: Type.Number(),
  nodeUsage: Type.Number(),
  cpuCoreCount: Type.Number(),
  cpuUsage: Type.Number(),
  gpuCoreCount: Type.Number(),
  gpuUsage: Type.Number(),
  pendingJobCount: Type.Number(),
  partitionStatus: Type.Enum(SummaryPartitionInfo_PartitionStatus),
});

export type PartitionInfo = Static<typeof PartitionInfo>;

export const SummaryClusterInfo = Type.Object({
  clusterId: Type.String(),
  nodeCount: Type.Number(),
  runningNodeCount: Type.Number(),
  idleNodeCount: Type.Number(),
  notAvailableNodeCount: Type.Optional(Type.Number()),
  cpuCoreCount: Type.Number(),
  runningCpuCount: Type.Number(),
  idleCpuCount: Type.Number(),
  notAvailableCpuCount: Type.Optional(Type.Number()),
  gpuCoreCount: Type.Number(),
  runningGpuCount: Type.Number(),
  idleGpuCount: Type.Number(),
  notAvailableGpuCount: Type.Optional(Type.Number()),
  runningJobCount: Type.Number(),
  pendingJobCount: Type.Number(),
  nodeUsage: Type.Number(),
  cpuUsage: Type.Number(),
  gpuUsage: Type.Number(),
  partitions: Type.Array(PartitionInfo),
});

export type SummaryClusterInfo = Static<typeof SummaryClusterInfo>;

export const GetAllSummaryClustersInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusterIds: Type.Array(Type.String()),
    isFullDisplayMode: Type.Boolean(),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(SummaryClusterInfo),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetAllSummaryClustersInfoSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const reply = await libWebGetUserInfo(
    info.identityId,
    publicConfig.MIS_SERVER_URL,
    runtimeConfig.SCOW_API_AUTH_TOKEN,
  );

  const accountNames =
    reply?.affiliations.filter((x) => x.accountState !== AccountState.ACCOUNT_DELETED).map((a) => a.accountName) || [];

  const { clusterIds, isFullDisplayMode } = req.query;

  const client = getClient(ConfigServiceClient);

  // 并行获取所有集群信息，失败的集群只记录日志
  const clusterInfoPromises = clusterIds.map(async (clusterId) => {
    const reply = await asyncUnaryCall(client, "getSummaryClusterInfo", {
      cluster: clusterId.trim(),
      accountNames,
    });

    if (isFullDisplayMode) {
      // 完整模式，返回所有数据
      return { ...reply, clusterId } as SummaryClusterInfo;
    } else {
      const filteredReply = {
        ...reply,
        notAvailableNodeCount: undefined,
        notAvailableCpuCount: undefined,
        notAvailableGpuCount: undefined,
        partitions: reply.partitions.map((partition) => ({
          ...partition,
        })),
      };
      return { ...filteredReply, clusterId } as SummaryClusterInfo;
    }
  });

  const allResults = await Promise.allSettled(clusterInfoPromises);

  const results = allResults
    .filter((result): result is PromiseFulfilledResult<SummaryClusterInfo> => result.status === "fulfilled")
    .map((result) => result.value);

  const errors = allResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result, index) => ({
      clusterId: clusterIds[index],
      error: result.reason,
    }));

  errors.forEach(({ clusterId, error }) => {
    console.error(
      `Failed to get cluster info for ${clusterId}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
  });

  return { 200: { results } };
});
