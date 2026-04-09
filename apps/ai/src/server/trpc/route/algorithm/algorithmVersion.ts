/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import path, { basename, dirname, join } from "path";
import { clusters } from "src/server/config/clusters";
import { Algorithm } from "src/server/entities/Algorithm";
import { AlgorithmVersion, SharedStatus } from "src/server/entities/AlgorithmVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { PlatformRole } from "src/server/trpc/route/auth";
import { checkClusterAvailable, shouldPathsSkipPermissionCheck } from "src/server/utils/clusters";
import { checkIsPublicPaths } from "src/server/utils/clusters";
import { ensureAiUserShareEnabled } from "src/server/utils/assetShare";
import { forkEntityManager } from "src/server/utils/getOrm";
import { buildUserMap } from "src/server/trpc/route/utils/userMap";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { SHARED_TARGET } from "src/server/utils/share";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";
import { driver } from "../../Driver";
import { withFileDriver } from "../../Driver/fileDriver/fileDriver";
import { booleanQueryParam } from "../utils";
import { buildSharedTopDir } from "../utils/sharedTopDir";
import { buildVersionMap, mapAssetEntityGroupsWithVersions } from "../utils/versionHelpers";

export const getAlgorithmVersions = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/algorithms/{algorithmId}/versions",
      tags: ["algorithmVersion"],
      summary: "get algorithmVersions",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    algorithmId: z.number(),
    isPublic:booleanQueryParam().optional(),
  }))
  .output(z.object({ items: z.array(z.object({
    id:z.number(),
    versionName:z.string(),
    versionDescription:z.string().optional(),
    path:z.string(),
    privatePath: z.string(),
    sharedStatus:z.enum(SharedStatus),
    createTime:z.string().optional(),
    updateTime: z.string().optional(),
  })), count: z.number() }))
  .query(async ({ input:{ algorithmId, page, pageSize, isPublic } }) => {
    const em = await forkEntityManager();
    const [items, count] = await em.findAndCount(AlgorithmVersion,
      {
        algorithm: algorithmId,
        ...isPublic ? { sharedStatus:SharedStatus.SHARED } : {},
      },
      {
        populate: ["algorithm"],
        ...paginationProps(page, pageSize),
        orderBy: { createTime: "desc" },
      });

    return { items:items.map((x) => {
      const createTime = x.createTime ? x.createTime.toISOString() : undefined;
      const updateTime = x.updateTime ? x.updateTime.toISOString() : undefined;
      return {
        id:x.id,
        versionName:x.versionName,
        versionDescription:x.versionDescription,
        sharedStatus:x.sharedStatus,
        createTime,
        path:x.path,
        privatePath: x.privatePath,
        updateTime: updateTime ?? createTime,
      };
    }), count };
  });

export const getMultipleAlgorithmVersions = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms/versions",
      tags: ["algorithmVersion"],
      summary: "get multiple algorithmVersions",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    algorithmIds: z.array(z.number()),
    isPublic:booleanQueryParam().optional(),
  }))
  .output(
    z.array(
      z.object({ items: z.array(z.object({
        id:z.number(),
        versionName:z.string(),
        versionDescription:z.string().optional(),
        path:z.string(),
        privatePath: z.string(),
        sharedStatus:z.enum(SharedStatus),
        createTime:z.string().optional(),
        updateTime: z.string().optional(),
      })), count: z.number() }),
    ),
  )
  .query(async ({ input:{ algorithmIds, isPublic, page, pageSize } }) => {
    const em = await forkEntityManager();

    const items = await em.find(AlgorithmVersion,
      {
        algorithm: { $in: algorithmIds },
        ...isPublic ? { sharedStatus: SharedStatus.SHARED } : {},
      }
      , {
        populate: ["algorithm"],
        ...paginationProps(page, pageSize),
        orderBy: { createTime: "desc" },
      });

    const groupedResults = algorithmIds.map((algorithmId) => {
      const algorithmItems = items.filter((x) => x.algorithm.id === algorithmId);

      return {
        items: algorithmItems.map((x) => ({
          id: x.id,
          versionName: x.versionName,
          versionDescription: x.versionDescription,
          sharedStatus: x.sharedStatus,
          createTime: x.createTime ? x.createTime.toISOString() : undefined,
          path: x.path,
          privatePath: x.privatePath,
        })),
        count: algorithmItems.length,
      };
    });

    return groupedResults;
  });

const AlgorithmVersionItemSchema = z.object({
  id: z.number(),
  versionName: z.string(),
  versionDescription: z.string().optional(),
});

const AlgorithmGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  versions: z.array(AlgorithmVersionItemSchema),
  ownerName: z.string().optional(),
  ownerId: z.string().optional(),
  isPlatformOwned:z.boolean(),
});

export const getAllAlgorithmVersions = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms/all/versions",
      tags: ["algorithmVersion"],
      summary: "get all algorithmVersions",
    },
  })
  .input(z.object({
    clusterId: z.string().optional(),
  }))
  .output(z.object({
    personal: z.array(AlgorithmGroupSchema),
    public: z.array(AlgorithmGroupSchema),
  }))
  .query(async ({ input:{ clusterId },ctx: { user } }) => {
    const em = await forkEntityManager();

    const personalAlgorithms = await em.find(Algorithm, {
      $and: [
        { owner: user.identityId, isPlatformOwned: false }, // 开发训练页的我的算法只展示个人创建的非平台算法
        clusterId ? { clusterId } : {},
      ],
    }, {
      orderBy: { createTime: "desc" },
    });

    const publicAlgorithms = await em.find(Algorithm, {
      $and: [
        { isShared: true },
        clusterId ? { clusterId } : {},
      ],
    }, {
      orderBy: { createTime: "desc" },
    });

    const algorithmIds = [
      ...personalAlgorithms.map((algorithm) => algorithm.id),
      ...publicAlgorithms.map((algorithm) => algorithm.id),
    ];

    const versions = algorithmIds.length > 0
      ? await em.find(AlgorithmVersion, {
        algorithm: { $in: algorithmIds },
      }, {
        populate: ["algorithm"],
        orderBy: { createTime: "desc" },
      })
      : [];

    const versionMap = buildVersionMap(versions, (version) => version.algorithm.id);

    const allAlgorithms = [...personalAlgorithms, ...publicAlgorithms];
    const userMap = await buildUserMap(allAlgorithms.map((a) => a.owner));

    return mapAssetEntityGroupsWithVersions<Algorithm, AlgorithmVersion, z.infer<typeof AlgorithmGroupSchema>>({
      personalEntities: personalAlgorithms,
      publicEntities: publicAlgorithms,
      versionMap,
      getEntityId: (algorithm) => algorithm.id,
      isVersionShared: (version) => version.sharedStatus === SharedStatus.SHARED,
      mapResult: (algorithm, relatedVersions) => ({
        id: algorithm.id,
        name: algorithm.name,
        description: algorithm.description,
        ownerName: userMap[algorithm.owner] ?? algorithm.owner,
        ownerId: algorithm.owner,
        isPlatformOwned: algorithm.isPlatformOwned,
        versions: relatedVersions.map((version) => ({
          id: version.id,
          versionName: version.versionName,
          versionDescription: version.versionDescription,
        })),
      }),
    });
  });

export const createAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms/{algorithmId}/versions",
      tags: ["algorithmVersion"],
      summary: "create a new algorithmVersion",
    },
  })
  .input(z.object({
    versionName: z.string(),
    path: z.string(),
    versionDescription: z.string().optional(),
    algorithmId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.object({ id: z.number() }))
  .use(async ({ input:{ algorithmId,versionName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createAlgorithmVersion,
    };

    const em = await forkEntityManager();
    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm) throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not Found` });

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        algorithmId,
        versionId:(res.data as any).id,
        algorithmName:algorithm.name,
        algorithmVersionName:versionName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          algorithmId,
          algorithmName:algorithm.name,
          algorithmVersionName:versionName,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { algorithmId, isPlatformOwned = false, versionName, path } = input;
    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm) throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not Found` });

    if (!isPlatformOwned && algorithm && algorithm.owner !== user.identityId) {
      const detailMessage =
        `Algorithm id:${algorithmId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "CONFLICT",
        message: "Operation failed: The algorithm asset does not belong to the current user.",
      });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can create platform owned algorithm version",
        });
      }
    }

    const algorithmVersionExist = await em.findOne(AlgorithmVersion,
      { versionName, algorithm });
    if (algorithmVersionExist)
      throw new TRPCError({ code: "CONFLICT", message: `AlgorithmVersion name:${versionName} already exist` });

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, algorithm.clusterId);

    const noCheckPermission = shouldPathsSkipPermissionCheck(algorithm.clusterId,
      [path], isPlatformOwned);

    // 检查目录是否存在
    await driver.withFileDriver({
      clusterId:algorithm.clusterId,
      user:user.identityId,
    }, async (fileDriver) => {
      await fileDriver.checkCreateResourcePath(path, noCheckPermission);
    }, logger);

    const isPathExisted = await withFileDriver(
      { clusterId: algorithm.clusterId, user: user.identityId },
      async (driver) => await driver.exists(path, noCheckPermission),
      logger,
    );
    if (!isPathExisted) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${path} does not exist` });
    }

    const algorithmVersion = new AlgorithmVersion({ ...input, privatePath: path, algorithm: algorithm });
    await em.persistAndFlush(algorithmVersion);
    return { id: algorithmVersion.id };
  });

export const updateAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/algorithms/{algorithmId}/versions/{algorithmVersionId}",
      tags: ["algorithmVersion"],
      summary: "update a algorithmVersion",
    },
  })
  .input(z.object({
    algorithmId: z.number(),
    algorithmVersionId: z.number(),
    versionName: z.string(),
    versionDescription: z.string().optional(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.object({ id: z.number() }))
  .use(async ({ input:{ algorithmId,algorithmVersionId,versionName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateAlgorithmVersion,
    };

    const em = await forkEntityManager();

    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm) throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        algorithmId,
        versionId:algorithmVersionId,
        algorithmName:algorithm.name,
        algorithmVersionName: versionName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          algorithmId,
          versionId:algorithmVersionId,
          algorithmName:algorithm.name,
          algorithmVersionName: versionName,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { algorithmId, algorithmVersionId, versionName, versionDescription, isPlatformOwned } = input;

    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm) throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can update platform owned algorithm version",
        });
      }
    }

    if (!isPlatformOwned && algorithm.owner !== user.identityId) {
      const detailMessage =
        `Algorithm id:${algorithmId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The algorithm asset does not belong to the current user.",
      });
    }

    const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
    if (!algorithmVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmVersionId} not found` });

    const algorithmVersionExist = await em.findOne(AlgorithmVersion,
      { versionName: versionName, algorithm });

    if (algorithmVersionExist && algorithmVersionExist !== algorithmVersion) {
      throw new TRPCError({ code: "CONFLICT", message: `AlgorithmVersion name:${versionName} already exist` });
    }

    if (algorithmVersion.sharedStatus === SharedStatus.SHARING ||
      algorithmVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of algorithmVersion ${algorithmVersionId} exists`,
      });
    }

    const needUpdateSharedPath = algorithmVersion.sharedStatus === SharedStatus.SHARED
    && versionName !== algorithmVersion.versionName;

    // 更新已分享目录下的版本路径名称
    if (needUpdateSharedPath && !isPlatformOwned) {
      // 获取更新后的已分享版本路径
      const newVersionSharedPath = await driver.withFileDriver({
        clusterId:algorithm.clusterId,
        user:user.identityId,
      }, async (fileDriver) => {
        return await fileDriver.getUpdatedSharedPath(versionName,dirname(algorithmVersion.path));
      }, logger);

      const baseFolderName = basename(algorithmVersion.path);

      algorithmVersion.path = join(newVersionSharedPath, baseFolderName);
    }

    algorithmVersion.versionName = versionName;
    algorithmVersion.versionDescription = versionDescription;

    await em.flush();
    return { id: algorithmVersion.id };
  });

export const deleteAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/algorithms/{algorithmId}/versions/{algorithmVersionId}",
      tags: ["algorithmVersion"],
      summary: "delete a new algorithmVersion",
    },
  })
  .input(z.object({
    algorithmVersionId: z.number(),
    algorithmId:z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.void())
  .use(async ({ input:{ algorithmId,algorithmVersionId }, ctx, next }) => {

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteAlgorithmVersion,
    };

    const em = await forkEntityManager();
    const algorithmVersion = await em.findOne(AlgorithmVersion, { id:algorithmVersionId });
    if (!algorithmVersion) throw new Error(`AlgorithmVersion id:${algorithmVersionId} not found`);

    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} is not found` });

    const res = await next({ ctx });

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        algorithmId,
        versionId:algorithmVersionId,
        algorithmName:algorithm.name,
        algorithmVersionName:algorithmVersion.versionName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          algorithmId,
          versionId:algorithmVersionId,
          algorithmName:algorithm.name,
          algorithmVersionName:algorithmVersion.versionName,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input:{ algorithmVersionId, algorithmId, isPlatformOwned }, ctx: { user } }) => {
    const em = await forkEntityManager();
    const algorithmVersion = await em.findOne(AlgorithmVersion, { id:algorithmVersionId });
    if (!algorithmVersion) throw new Error(`AlgorithmVersion id:${algorithmVersionId} not found`);

    const algorithm = await em.findOne(Algorithm, { id: algorithmId },
      { populate: ["versions.sharedStatus"]});
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} is not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can delete platform owned algorithm version",
        });
      }
    }

    if (!isPlatformOwned && algorithm.owner !== user.identityId) {
      const detailMessage =
        `Algorithm id:${algorithmId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The algorithm asset does not belong to the current user.",
      });
    }

    // 正在分享中或取消分享中的版本，不可删除
    if (!isPlatformOwned && algorithmVersion.sharedStatus === SharedStatus.SHARING
      || algorithmVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError(
        { code: "PRECONDITION_FAILED",
          message: `AlgorithmVersion (id:${algorithmVersionId}) is currently being shared or unshared` });
    }

    // 如果是已分享的算法版本，则删除分享; 如果是公共数据资产则不删除分享文件夹
    if (algorithmVersion.sharedStatus === SharedStatus.SHARED) {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, algorithm.clusterId);

      if (!isPlatformOwned) {
        try {
          await driver.withFileDriver({
            clusterId:algorithm.clusterId,
            user:user.identityId,
          }, async (fileDriver) => {
            await fileDriver.checkSharePermission(algorithmVersion.privatePath);
          }, logger);

          const pathToUnshare
          = algorithm.versions.filter((v) =>
            (v.id !== algorithmVersionId && v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
          // 除了此版本以外仍有其他已分享的版本则取消分享当前版本
            dirname(algorithmVersion.path)
          // 除了此版本以外没有其他已分享的版本则取消分享整个算法
            : dirname(dirname(algorithmVersion.path));

          await driver.withFileDriver({
            clusterId:algorithm.clusterId,
            user:user.identityId,
          }, async (fileDriver) => {
            await fileDriver.unShareFileOrDir(pathToUnshare);
          }, logger);

        } catch (e) {
          logger.error("ssh failure occurred when unshare" +
            `algorithmVersion ${algorithmVersionId} of algorithm ${algorithmId}`, e);
        }
      }

      algorithm.isShared = algorithm.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 1
        ? true : false;
      await em.flush();
    }

    em.remove(algorithmVersion);
    await em.flush();
    return;
  });

export const shareAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms/{algorithmId}/versions/{algorithmVersionId}/share",
      tags: ["algorithmVersion"],
      summary: "share a algorithmVersion",
    },
  })
  .input(z.object({
    algorithmId: z.number(),
    algorithmVersionId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.void())
  .use(async ({ input:{ algorithmId,algorithmVersionId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shareAlgorithmVersion,
    };

    const em = await forkEntityManager();
    const algorithmVersion = await em.findOne(AlgorithmVersion, { id:algorithmVersionId });
    if (!algorithmVersion) throw new Error(`AlgorithmVersion id:${algorithmVersionId} not found`);

    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} is not found` });


    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        algorithmId,
        versionId:algorithmVersionId,
        algorithmName:algorithm.name,
        algorithmVersionName:algorithmVersion.versionName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          algorithmId,
          versionId:algorithmVersionId,
          algorithmName:algorithm.name,
          algorithmVersionName:algorithmVersion.versionName,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input:{ algorithmId, algorithmVersionId, isPlatformOwned }, ctx: { user } }) => {
    const em = await forkEntityManager();
    ensureAiUserShareEnabled(isPlatformOwned);
    const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
    if (!algorithmVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

    if (algorithmVersion.sharedStatus === SharedStatus.SHARED)
      throw new TRPCError({ code: "CONFLICT", message: `AlgorithmVersion id:${algorithmId} is already shared` });

    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can share platform owned algorithm version",
        });
      }
    }

    if (!isPlatformOwned && algorithm.owner !== user.identityId) {
      const detailMessage =
        `Algorithm id:${algorithmId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The algorithm asset does not belong to the current user.",
      });
    }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, algorithm.clusterId);

    // 若公共资产路径改变，则无法发布
    const checkIsPublicAssetAlgorithmVersion = checkIsPublicPaths(
      algorithm.clusterId,
      [algorithmVersion.path],
    );

    if (isPlatformOwned && !checkIsPublicAssetAlgorithmVersion) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to algorithm version files; publishing is not allowed.",
      });
    }

    await driver.withFileDriver({
      clusterId:algorithm.clusterId,
      user:user.identityId,
    }, async (fileDriver) => {
      await fileDriver.checkSharePermission(algorithmVersion.privatePath, isPlatformOwned);
    }, logger);

    algorithmVersion.sharedStatus = SharedStatus.SHARING;
    em.persist([algorithmVersion]);
    await em.flush();

    if (isPlatformOwned) {
      const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
      if (!algorithmVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

      const algorithm = await em.findOne(Algorithm, { id: algorithmId });
      if (!algorithm)
        throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

      algorithmVersion.sharedStatus = SharedStatus.SHARED;
      algorithmVersion.path = algorithmVersion.privatePath;

      if (!algorithm.isShared) { algorithm.isShared = true; };

      await em.persistAndFlush([algorithmVersion, algorithm]);

      return;
    }

    const homeDir = await driver.withFileDriver({
      clusterId:algorithm.clusterId,
      user:user.identityId,
    }, async (fileDriver) => {
      return await fileDriver.getHomeDirectory();
    }, logger);
    const sharedTopDir = buildSharedTopDir(algorithm.clusterId, homeDir);

    const successCallback = async (targetFullPath: string) => {
      const em = await forkEntityManager();

      const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
      if (!algorithmVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

      const algorithm = await em.findOne(Algorithm, { id: algorithmId });
      if (!algorithm)
        throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

      const versionPath = join(targetFullPath, path.basename(algorithmVersion.privatePath));
      algorithmVersion.sharedStatus = SharedStatus.SHARED;
      algorithmVersion.path = versionPath;
      if (!algorithm.isShared) { algorithm.isShared = true; };

      await em.persistAndFlush([algorithmVersion, algorithm]);
    };

    const failureCallback = async () => {
      const em = await forkEntityManager();

      const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
      if (!algorithmVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

      algorithmVersion.sharedStatus = SharedStatus.UNSHARED;
      await em.persistAndFlush([algorithmVersion]);
    };

    driver.withFileDriver({
      clusterId:algorithm.clusterId,
      user:user.identityId,
    }, async (fileDriver) => {
      await fileDriver.shareFileOrDir({
        sourceFilePath:algorithmVersion.privatePath ,
        sharedTarget:SHARED_TARGET.ALGORITHM,
        targetName:algorithm.name,
        targetSubName:algorithmVersion.versionName,
        sharedTopDir,
      }, successCallback, failureCallback);
    }, logger);

    return;
  });

export const unShareAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/algorithms/{algorithmId}/versions/{algorithmVersionId}/share",
      tags: ["algorithmVersion"],
      summary: "unshare a algorithmVersion",
    },
  })
  .input(z.object({
    algorithmVersionId: z.number(),
    algorithmId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.void())
  .mutation(async ({ input:{ algorithmVersionId, algorithmId, isPlatformOwned }, ctx: { user } }) => {
    const em = await forkEntityManager();
    ensureAiUserShareEnabled(isPlatformOwned);
    const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
    if (!algorithmVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmVersionId} not found` });

    if (algorithmVersion.sharedStatus === SharedStatus.UNSHARED)
      throw new TRPCError({
        code: "CONFLICT",
        message: `AlgorithmVersion id:${algorithmVersionId} is already unShared`,
      });

    const algorithm = await em.findOne(Algorithm, { id: algorithmId }, {
      populate: ["versions.sharedStatus"],
    });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can unshare platform owned algorithm version",
        });
      }
    }

    if (!isPlatformOwned && algorithm.owner !== user.identityId) {
      const detailMessage =
        `Algorithm id:${algorithmId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The algorithm asset does not belong to the current user.",
      });
    }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, algorithm.clusterId);

    algorithmVersion.sharedStatus = SharedStatus.UNSHARING;
    em.persist([algorithmVersion]);
    await em.flush();

    const successCallback = async () => {
      const em = await forkEntityManager();

      const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
      if (!algorithmVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

      const algorithm = await em.findOne(Algorithm, { id: algorithmId }, {
        populate: ["versions.sharedStatus"],
      });
      if (!algorithm)
        throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

      algorithmVersion.sharedStatus = SharedStatus.UNSHARED;
      algorithmVersion.path = algorithmVersion.privatePath;
      algorithm.isShared = algorithm.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0
        ? true : false;

      await em.persistAndFlush([algorithmVersion, algorithm]);
    };

    const failureCallback = async () => {
      const em = await forkEntityManager();

      const algorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithmVersionId });
      if (!algorithmVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

      algorithmVersion.sharedStatus = SharedStatus.SHARED;
      await em.persistAndFlush([algorithmVersion]);
    };

    if (isPlatformOwned) {
      await successCallback();
      return;
    }

    const sharedAlgorithmVersionPath =
    algorithm.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
    // 如果还有其他的已分享版本则只取消此版本的分享
      dirname(algorithmVersion.path)
    // 如果没有其他的已分享版本则取消整个算法的分享
      : dirname(dirname(algorithmVersion.path));

    driver.withFileDriver({
      clusterId:algorithm.clusterId,
      user:user.identityId,
    }, async (fileDriver) => {
      await fileDriver.unShareFileOrDir(sharedAlgorithmVersionPath, successCallback, failureCallback);
    }, logger);
    return;
  });

export const copyPublicAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms/{algorithmId}/versions/{algorithmVersionId}/copy",
      tags: ["algorithmVersion"],
      summary: "copy a public algorithm version",
    },
  })
  .input(z.object({
    algorithmId: z.number(),
    algorithmVersionId: z.number(),
    algorithmName: z.string(),
    versionName: z.string(),
    versionDescription: z.string(),
    path: z.string(),
  }))
  .output(z.object({ targetAlgorithmId:z.number(),targetAlgorithmVersionId:z.number() }))
  .use(async ({ input:{ algorithmId,algorithmVersionId,algorithmName,versionName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.copyAlgorithmVersion,
    };

    const em = await forkEntityManager();
    const algorithmVersion = await em.findOne(AlgorithmVersion, { id:algorithmVersionId });
    if (!algorithmVersion) throw new Error(`AlgorithmVersion id:${algorithmVersionId} not found`);

    const algorithm = await em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} is not found` });

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        sourceAlgorithmId:algorithmId,
        sourceAlgorithmVersionId:algorithmVersionId,
        targetAlgorithmId: (res.data as any).targetAlgorithmId,
        targetAlgorithmVersionId: (res.data as any).targetAlgorithmVersionId,
        sourceAlgorithmName:algorithm.name,
        sourceAlgorithmVersionName:algorithmVersion.versionName,
        targetAlgorithmName:algorithmName,
        targetAlgorithmVersionName:versionName,
      } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          sourceAlgorithmId:algorithmId,
          sourceAlgorithmVersionId:algorithmVersionId,
          sourceAlgorithmName:algorithm.name,
          sourceAlgorithmVersionName:algorithmVersion.versionName,
          targetAlgorithmName:algorithmName,
          targetAlgorithmVersionName:versionName,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    // 1. 检查算法版本是否为公开版本
    const algorithmVersion = await em.findOne(AlgorithmVersion,
      { id: input.algorithmVersionId, sharedStatus: SharedStatus.SHARED },
      { populate: ["algorithm"]});

    if (!algorithmVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Algorithm Version ${input.algorithmVersionId} does not exist or is not public`,
      });
    }
    // 2. 检查该用户是否已有同名算法 (平台身份时可以有同名数据集)
    const algorithm = await em.findOne(Algorithm, {
      name: input.algorithmName,
      owner: user.identityId,
      isPlatformOwned: false,
    });
    if (algorithm) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `An algorithm with the same name as ${input.algorithmName} already exists`,
      });
    }
    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, algorithmVersion.algorithm.$.clusterId);

    // 3. 检查用户是否可以将源算法拷贝至目标目录

    await driver.withFileDriver({
      clusterId:algorithmVersion.algorithm.$.clusterId,
      user:user.identityId,
    }, async (fileDriver) => {
      await fileDriver.checkCopyFilePath(input.path,path.basename(algorithmVersion.path));
    }, logger);

    // 4. 写入数据
    const newAlgorithm = new Algorithm({
      name: input.algorithmName,
      owner: user.identityId,
      framework: algorithmVersion.algorithm.$.framework,
      description: algorithmVersion.algorithm.$.description,
      clusterId: algorithmVersion.algorithm.$.clusterId,
    });

    const newAlgorithmVersion = new AlgorithmVersion({
      versionName: input.versionName,
      versionDescription: input.versionDescription,
      path: input.path,
      privatePath: input.path,
      algorithm: newAlgorithm,
    });

    const checkIsPublicPathsResult = checkIsPublicPaths(
      algorithmVersion.algorithm.$.clusterId,
      [algorithmVersion.path],
    );

    // 若公共资产路径改变，则无法复制
    if (!checkIsPublicPathsResult && algorithmVersion.algorithm.$.isPlatformOwned === true) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to the algorithm version files; copying is not allowed.",
      });
    }

    try {
      await withFileDriver(
        { clusterId:algorithmVersion.algorithm.$.clusterId, user:user.identityId },
        async (driver) => {
          const cluster = clusters[algorithmVersion.algorithm.$.clusterId];

          // scowd复制需要再路径最后加上文件夹名
          await driver.copy(algorithmVersion.path,
            cluster.scowd?.enabled ? path.join(input.path,path.basename(algorithmVersion.path)) : input.path,
            checkIsPublicPathsResult);
        },
        logger,
      );
      // 递归修改文件权限和拥有者
      await withFileDriver(
        { clusterId:algorithmVersion.algorithm.$.clusterId, user: user.identityId },
        async (driver) => {
          await driver.chmod(input.path,"0750");
        },
        logger,
      );

      await em.persistAndFlush([newAlgorithm, newAlgorithmVersion]);
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Copy Error ${err as any}`,
      });
    }

    return { targetAlgorithmId:newAlgorithm.id, targetAlgorithmVersionId:newAlgorithmVersion.id };
  });
