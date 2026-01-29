import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { basename, dirname, join } from "path";
import { Algorithm, Framework } from "src/server/entities/Algorithm";
import { AlgorithmVersion, SharedStatus } from "src/server/entities/AlgorithmVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { getCurrentClusters } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { driver } from "../../Driver";
import { booleanQueryParam, clusterExist } from "../utils";


export const getAlgorithms = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/algorithms",
      tags: ["algorithm"],
      summary: "get algorithms",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    framework: z.enum(Framework).optional(),
    nameOrDesc: z.string().optional(),
    clusterId: z.string().optional(),
    isPublic: booleanQueryParam().optional(),
  }))
  .output(z.object({ items: z.array(z.object({
    id:z.number(),
    name:z.string(),
    owner:z.string(),
    framework:z.enum(Framework),
    isShared:z.boolean(),
    description:z.string().optional(),
    clusterId:z.string(),
    createTime:z.string().optional(),
    versions:z.array(z.object({
      id: z.number(),
      path: z.string(),
    })),
  })), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {

    const { page, pageSize, framework, nameOrDesc, clusterId, isPublic } = input;
    // 如果查询某一个集群
    if (clusterId) {
      // 再次检查当前查询集群是否为在线可用集群
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);
    }

    const em = await forkEntityManager();

    const [items, count] = await em.findAndCount(Algorithm, {
      $and:[
        isPublic ? { isShared:true } :
          { owner: user.identityId },
        framework ? { framework } : {},
        clusterId ? { clusterId } : {},
        nameOrDesc ?
          { $or: [
            { name: { $like: `%${nameOrDesc}%` } },
            { description: { $like: `%${nameOrDesc}%` } },
          ]} : {},
      ],
    },
    {
      ...paginationProps(page, pageSize),
      populate: ["versions.sharedStatus", "versions.privatePath"],
      orderBy: { createTime: "desc" },
    });

    return { items: items.map((x) => {
      return {
        id:x.id,
        name:x.name,
        owner:x.owner,
        framework:x.framework,
        isShared:x.isShared,
        description:x.description,
        clusterId:x.clusterId,
        createTime:x.createTime ? x.createTime.toISOString() : undefined,
        versions: isPublic ?
          x.versions.filter((x) => (x.sharedStatus === SharedStatus.SHARED)).map((y) => ({ id: y.id, path: y.path }))
          : x.versions.map((y) => ({ id: y.id, path: y.privatePath })),
      }; }), count };

  });


export const createAlgorithm = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms",
      tags: ["algorithm"],
      summary: "create a new algorithms",
    },
  })
  .input(z.object({
    name: z.string(),
    framework: z.enum(Framework),
    clusterId: z.string(),
    description: z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ clusterId,name }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createAlgorithm,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        algorithmId:res.data as number,
        algorithmName:name,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          clusterId,
          algorithmName:name,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {

    const currentClusterIds = await getCurrentClusters(user.identityId);

    if (!clusterExist(input.clusterId, currentClusterIds)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cluster id ${input.clusterId} does not exist.`,
      });
    }

    const em = await forkEntityManager();
    const algorithmExist = await em.findOne(Algorithm, { name:input.name, owner: user.identityId });
    if (algorithmExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Algorithm name ${input.name} already exist`,
      });
    }

    const algorithm = new Algorithm({ ...input, owner: user.identityId });
    await em.persistAndFlush(algorithm);
    return algorithm.id;
  });

export const updateAlgorithm = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/algorithms/{id}",
      tags: ["algorithm"],
      summary: "update a algorithm",
    },
  })
  .input(z.object({
    id:z.number(),
    name: z.string(),
    framework: z.enum(Framework),
    description: z.string().optional(),
  }))
  .output(z.void())
  .use(async ({ input:{ id }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateAlgorithm,
    };

    const em = await forkEntityManager();
    const algorithm = await em.findOne(Algorithm, { id });

    if (!algorithm) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Algorithm (id:${id}) is not found`,
      });
    }

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        algorithmId:id,
        algorithmName:algorithm.name,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          algorithmId:id,
          algorithmName:algorithm.name,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input:{ name, framework, description, id }, ctx: { user } }) => {
    const em = await forkEntityManager();
    const algorithm = await em.findOne(Algorithm, { id });

    if (!algorithm) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Algorithm (id:${id}) is not found`,
      });
    }

    const algorithmExist = await em.findOne(Algorithm, { name,
      owner: user.identityId,
    });

    if (algorithmExist && algorithmExist !== algorithm) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Algorithm name ${name} already exist`,
      });
    }

    if (algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Algorithm ${id} not accessible` });

    // 存在正在分享或正在取消分享的算法版本，则不可更新名称
    const changingVersions = await em.find(AlgorithmVersion, { algorithm,
      $or: [
        { sharedStatus: SharedStatus.SHARING },
        { sharedStatus: SharedStatus.UNSHARING },
      ]},
    );
    if (changingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of algorithm ${id} exists`,
      });
    }

    // 如果是已分享的算法且名称发生变化，则变更共享路径下的此算法名称为新名称
    if (algorithm.isShared && name !== algorithm.name) {

      const sharedVersions = await em.find(AlgorithmVersion, { algorithm, sharedStatus: SharedStatus.SHARED });
      const oldPath = dirname(dirname(sharedVersions[0].path));

      // 获取更新后的当前算法的共享路径名称

      const newAlgorithmSharedPath = await driver.withFileDriver({
        clusterId:algorithm.clusterId,
        user:user.identityId,
      }, async (fileDriver) => {
        return await fileDriver.getUpdatedSharedPath(name,oldPath);
      }, logger);

      // 更新已分享的版本的共享文件夹地址
      sharedVersions.map((v) => {
        const baseFolderName = basename(v.path);
        const newPath = join(newAlgorithmSharedPath, v.versionName, baseFolderName);

        v.path = newPath;
      });
    }

    algorithm.framework = framework;
    algorithm.name = name;
    algorithm.description = description;

    await em.flush();
    return;
  });

export const deleteAlgorithm = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/algorithms/{id}",
      tags: ["algorithm"],
      summary: "delete a algorithm",
    },
  })
  .input(z.object({ id: z.number() }))
  .output(z.void())
  .use(async ({ input:{ id }, ctx, next }) => {

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteAlgorithm,
    };

    const em = await forkEntityManager();
    const algorithm = await em.findOne(Algorithm, { id });

    if (!algorithm) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Algorithm (id:${id}) is not found`,
      });
    }

    const res = await next({ ctx });

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        algorithmId:id,
        algorithmName:algorithm.name,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          algorithmId:id,
          algorithmName:algorithm.name,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input:{ id }, ctx:{ user } }) => {
    const em = await forkEntityManager();
    const algorithm = await em.findOne(Algorithm, { id });

    if (!algorithm) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Algorithm (id:${id}) is not found`,
      });
    }

    if (algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Algorithm (id:${id}) not accessible` });

    const algorithmVersions = await em.find(AlgorithmVersion, { algorithm });

    const sharingVersions = algorithmVersions.filter(
      (v) => (v.sharedStatus === SharedStatus.SHARING || v.sharedStatus === SharedStatus.UNSHARING));

    // 有正在分享中或取消分享中的版本，则不可删除
    if (sharingVersions.length > 0) {
      throw new TRPCError(
        { code: "PRECONDITION_FAILED",
          message: `There is an algorithm version being shared or unshared of algorithm ${id}` });
    }

    const sharedVersions = algorithmVersions.filter((v) => (v.sharedStatus === SharedStatus.SHARED));

    // 获取此算法的共享的算法绝对路径
    if (sharedVersions.length > 0) {
      const sharedAlgorithmPath = dirname(dirname(sharedVersions[0].path));

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, algorithm.clusterId);

      const host = getClusterLoginNode(algorithm.clusterId);
      if (!host) { throw clusterNotFound(algorithm.clusterId); }

      await driver.withFileDriver({
        clusterId:algorithm.clusterId,
        user:user.identityId,
      }, async (fileDriver) => {
        await fileDriver.unShareFileOrDir(sharedAlgorithmPath);
      }, logger);
    }

    await em.removeAndFlush([...algorithmVersions, algorithm]);

    return;
  });
