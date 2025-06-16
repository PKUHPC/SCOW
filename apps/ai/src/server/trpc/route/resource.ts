import { TRPCError } from "@trpc/server";
import { AccountStatusFilter } from "src/models/Resource";
import { getUserInfo } from "src/server/auth/server";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { getCurrentClusters } from "src/server/utils/clusters";
import { getAssignedClusterPartitions, getUserAssignedResourceDetails } from "src/server/utils/resource";
import { z } from "zod";

export const resource = router({

  // 获取资源管理系统中已授权的 集群ID 列表
  getCurrentUserAssignedClusters: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/resource/currentClusterIds",
        tags: ["currentClusterIds"],
        summary: "获取资源管理系统中已授权的 集群ID 列表",
      },
    })
    .input(z.void())
    .output(z.object({
      clusterIds: z.array(z.string()),
    }))
    .query(async ({ ctx: { req, res } }) => {

      const userInfo = await getUserInfo(req, res);
      if (!userInfo) {
        throw new TRPCError({
          message: "User is UNAUTHORIZED",
          code: "UNAUTHORIZED",
        });
      }
      const results = await getCurrentClusters(userInfo.identityId);

      return { clusterIds: results };
    }),


  // 获取资源管理系统中用户关联账户的已授权的集群分区信息
  // 未配置资源管理返回{clusterPartitions: undefined}
  getUserAssociatedClusterPartitions: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/resource/userAssociatedClusterPartitions",
        tags: ["userAssociatedClusterPartitions"],
        summary: "获取资源管理中用户关联账户已授权的集群分区信息",
      },
    })
    .input(z.void())
    .output(z.object({
      clusterPartitions: z.record(z.string(), z.array(z.string())).optional(),
    }))
    .query(async ({ ctx: { req, res } }) => {

      const userInfo = await getUserInfo(req, res);
      if (!userInfo) {
        throw new TRPCError({
          message: "User is UNAUTHORIZED",
          code: "UNAUTHORIZED",
        });
      }
      const results = await getAssignedClusterPartitions(userInfo.identityId);

      return { clusterPartitions: results };
    }),

  // 获取资源管理中用户关联的账户，账户已授权集群与分区信息
  // 未配置资源管理返回{results: undefined}
  getUserAssignedResourceDetails: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/resource/userAssignedResourceDetails",
        tags: ["userAssignedResourceDetails"],
        summary: "获取资源管理中用户关联的账户，账户已授权集群与分区信息",
      },
    })
    .input(z.object({
      accountStatusFilter: z.enum([
        AccountStatusFilter.ALL,
        AccountStatusFilter.BLOCKED_ONLY,
        AccountStatusFilter.UNBLOCKED_ONLY]).optional(),
    }))
    .output(z.object({
      results: z.array(z.object({
        accountName: z.string(),
        assignedClusterPartitions: z.record(z.string(), z.array(z.string())),
      })).optional(),
    }))
    .query(async ({ input, ctx: { req, res } }) => {

      const userInfo = await getUserInfo(req, res);
      if (!userInfo) {
        throw new TRPCError({
          message: "User is UNAUTHORIZED",
          code: "UNAUTHORIZED",
        });
      }
      const results = await getUserAssignedResourceDetails(userInfo.identityId, input.accountStatusFilter);

      return { results };
    }),

});
