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
import { SharedStatus } from "src/models/common";
import { clusters } from "src/server/config/clusters";
import { Model } from "src/server/entities/Model";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { PlatformRole } from "src/server/trpc/route/auth";
import { checkClusterAvailable, checkIsPublicPaths, shouldPathsSkipPermissionCheck } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { buildUserMap } from "src/server/trpc/route/utils/userMap";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { ensureAiUserShareEnabled } from "src/server/utils/assetShare";
import { SHARED_TARGET }
  from "src/server/utils/share";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";
import { driver } from "../../Driver";
import { withFileDriver } from "../../Driver/fileDriver/fileDriver";
import { booleanQueryParam } from "../utils";
import { buildSharedTopDir } from "../utils/sharedTopDir";
import { buildVersionMap, mapAssetEntityGroupsWithVersions } from "../utils/versionHelpers";

export const VersionListSchema = z.object({
  id: z.number(),
  modelId: z.number(),
  versionName: z.string(),
  sharedStatus: z.enum(SharedStatus),
  versionDescription: z.string().optional(),
  algorithmVersion: z.string().optional(),
  path: z.string(),
  privatePath: z.string(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
});

export const versionList = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/models/{modelId}/versions",
      tags: ["modelVersions"],
      summary: "Read all modelVersions",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    modelId: z.number(),
    isPublic: booleanQueryParam().optional(),
  }))
  .output(z.object({ items: z.array(VersionListSchema), count: z.number() }))
  .query(async ({ input }) => {
    const em = await forkEntityManager();

    const [items, count] = await em.findAndCount(ModelVersion,
      {
        model: { id: input.modelId },
        ...input.isPublic ? { sharedStatus: SharedStatus.SHARED } : {},
      },
      {
        ...paginationProps(input.page, input.pageSize),
        orderBy: { createTime: "desc" },
      });

    return {
      items: items.map((x) => {
        const createTime = x.createTime ? x.createTime.toISOString() : undefined;
        const updateTime = x.updateTime ? x.updateTime.toISOString() : undefined;
        return {
          id: x.id,
          modelId: x.model.id,
          versionName: x.versionName,
          versionDescription: x.versionDescription,
          algorithmVersion: x.algorithmVersion,
          path: x.path,
          privatePath: x.privatePath,
          sharedStatus: x.sharedStatus,
          createTime,
          updateTime: updateTime ?? createTime,
        };
      }), count
    };
  });

export const getMultipleModelVersions = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/models/versions",
      tags: ["modelVersions"],
      summary: "get multiple modelVersions",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    modelIds: z.array(z.number()),
    isPublic: booleanQueryParam().optional(),
  }))
  .output(z.array(z.object({ items: z.array(VersionListSchema), count: z.number() })))
  .query(async ({ input: { modelIds, isPublic, page, pageSize } }) => {
    const em = await forkEntityManager();
    const items = await em.find(ModelVersion,
      {
        model: { $in: modelIds },
        ...isPublic ? { sharedStatus: SharedStatus.SHARED } : {},
      },
      {
        ...paginationProps(page, pageSize),
        orderBy: { createTime: "desc" },
      });

    const groupedResults = modelIds.map((modelId) => {
      const modelItems = items.filter((x) => x.model.id === modelId);
      return {
        items: modelItems.map((x) => ({
          id: x.id,
          modelId: x.model.id,
          versionName: x.versionName,
          versionDescription: x.versionDescription,
          algorithmVersion: x.algorithmVersion,
          path: x.path,
          privatePath: x.privatePath,
          sharedStatus: x.sharedStatus,
          createTime: x.createTime ? x.createTime.toISOString() : undefined,
        })),
        count: modelItems.length,
      };
    });

    return groupedResults;
  });

const ModelVersionItemSchema = z.object({
  id: z.number(),
  versionName: z.string(),
  versionDescription: z.string().optional(),
  algorithmVersion: z.string().optional(),
});

const ModelGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  algorithmName: z.string().optional(),
  algorithmFramework: z.string().optional(),
  versions: z.array(ModelVersionItemSchema),
  ownerName: z.string().optional(),
  ownerId: z.string().optional(),
  isPlatformOwned: z.boolean(),
});

export const getAllModelVersions = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/models/all/versions",
      tags: ["modelVersions"],
      summary: "Get all model versions grouped by owner scope",
    },
  })
  .input(z.object({
    clusterId: z.string().optional(),
  }))
  .output(z.object({
    personal: z.array(ModelGroupSchema),
    public: z.array(ModelGroupSchema),
  }))
  .query(async ({ input: { clusterId }, ctx: { user } }) => {
    const em = await forkEntityManager();

    const personalModels = await em.find(Model, {
      $and: [
        { owner: user.identityId, isPlatformOwned: false }, // 开发训练页的我的模型只展示个人创建的非平台模型
        clusterId ? { clusterId } : {},
      ],
    }, {
      orderBy: { createTime: "desc" },
    });

    const publicModels = await em.find(Model, {
      $and: [
        { isShared: true },
        clusterId ? { clusterId } : {},
      ],
    }, {
      orderBy: { createTime: "desc" },
    });

    const modelIds = [
      ...personalModels.map((model) => model.id),
      ...publicModels.map((model) => model.id),
    ];

    const versions = modelIds.length > 0
      ? await em.find(ModelVersion, {
        model: { $in: modelIds },
      }, {
        populate: ["model"],
        orderBy: { createTime: "desc" },
      })
      : [];

    const versionMap = buildVersionMap(versions, (version) => version.model.id);

    const allModels = [...personalModels, ...publicModels];
    const userMap = await buildUserMap(allModels.map((m) => m.owner));

    return mapAssetEntityGroupsWithVersions<Model, ModelVersion, z.infer<typeof ModelGroupSchema>>({
      personalEntities: personalModels,
      publicEntities: publicModels,
      versionMap,
      getEntityId: (model) => model.id,
      isVersionShared: (version) => version.sharedStatus === SharedStatus.SHARED,
      mapResult: (model, relatedVersions) => ({
        id: model.id,
        name: model.name,
        description: model.description,
        algorithmName: model.algorithmName,
        algorithmFramework: model.algorithmFramework,
        ownerName: userMap[model.owner] ?? model.owner,
        ownerId: model.owner,
        isPlatformOwned: model.isPlatformOwned,
        versions: relatedVersions.map((version) => ({
          id: version.id,
          versionName: version.versionName,
          versionDescription: version.versionDescription,
          algorithmVersion: version.algorithmVersion,
        })),
      }),
    });
  });

export const createModelVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/models/{modelId}/versions",
      tags: ["modelVersion"],
      summary: "Create a new modelVersion",
    },
  })
  .input(z.object({
    versionName: z.string(),
    versionDescription: z.string().optional(),
    algorithmVersion: z.string().optional(),
    path: z.string(),
    modelId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.object({ id: z.number() }))
  .use(async ({ input: { modelId, versionName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createModelVersion,
    };

    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });
    }

    if (res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId: (res.data as any).id,
          modelName: model.name,
          modelVersionName: versionName,
        },
      },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          modelName: model.name,
          modelVersionName: versionName,
        },
      },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: input.modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${input.modelId} not found` });
    }

    const isPlatformOwned = input.isPlatformOwned ?? false;

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can create platform owned model version",
        });
      }
    }

    if (!isPlatformOwned && model.owner !== user.identityId) {
      const detailMessage =
        `Model id:${input.modelId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    const modelVersionExist = await em.findOne(ModelVersion,
      { versionName: input.versionName, model });
    if (modelVersionExist) throw new TRPCError({ code: "CONFLICT", message: "ModelVersionExist already exist" });

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, model.clusterId);

    const noCheckPermission = shouldPathsSkipPermissionCheck(model.clusterId,
      [input.path], isPlatformOwned ?? false);

    const host = getClusterLoginNode(model.clusterId);

    if (!host) { throw clusterNotFound(model.clusterId); }
    // 检查目录是否存在
    const isPathExisted = await withFileDriver(
      { clusterId: model.clusterId, user: user.identityId },
      async (driver) => await driver.exists(input.path, noCheckPermission),
      logger,
    );
    if (!isPathExisted) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${input.path} does not exist` });
    }

    // 检查用户是否有读写权限
    await driver.withFileDriver({
      clusterId: model.clusterId,
      user: user.identityId,
    }, async (fileDriver) => {
      await fileDriver.checkCreateResourcePath(input.path, noCheckPermission);
    }, logger);

    const modelVersion = new ModelVersion({ ...input, privatePath: input.path, model: model });
    await em.persistAndFlush(modelVersion);
    return { id: modelVersion.id };
  });

export const updateModelVersion = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/model/{modelId}/versions/{versionId}",
      tags: ["modelVersion"],
      summary: "update a modelVersion",
    },
  })
  .input(z.object({
    versionId: z.number(),
    versionName: z.string(),
    versionDescription: z.string().optional(),
    algorithmVersion: z.string().optional(),
    modelId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.object({ id: z.number() }))
  .use(async ({ input: { modelId, versionId, versionName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateModelVersion,
    };

    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });
    }

    if (res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId,
          modelName: model.name,
          modelVersionName: versionName,
        },
      },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId,
          modelName: model.name,
          modelVersionName: versionName,
        },
      },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { versionId, versionName, versionDescription, algorithmVersion, modelId, isPlatformOwned } = input;

    const model = await em.findOne(Model, { id: modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can update platform owned model version",
        });
      }
    }

    if (!isPlatformOwned && model.owner !== user.identityId) {
      const detailMessage =
        `Model id:${modelId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    const modelVersion = await em.findOne(ModelVersion, { id: versionId });
    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });

    const modelVersionNameExist = await em.findOne(ModelVersion, { versionName, model, id: { $ne: versionId } });
    if (modelVersionNameExist) {
      throw new TRPCError({ code: "CONFLICT", message: "ModelVersion alreay exist" });
    }

    if (modelVersion.sharedStatus === SharedStatus.SHARING ||
      modelVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of modelVersion ${versionId} exists`,
      });
    }

    const needUpdateSharedPath = modelVersion.sharedStatus === SharedStatus.SHARED
      && versionName !== modelVersion.versionName;

    // 更新已分享目录下的版本路径名称
    if (needUpdateSharedPath && !isPlatformOwned) {
      // 获取更新后的已分享版本路径
      const newVersionSharedPath = await driver.withFileDriver({
        clusterId: model.clusterId,
        user: user.identityId,
      }, async (fileDriver) => {
        return await fileDriver.getUpdatedSharedPath(versionName, dirname(modelVersion.path));
      }, logger);

      const baseFolderName = basename(modelVersion.path);
      const newPath = join(newVersionSharedPath, baseFolderName);
      modelVersion.path = newPath;
    }

    modelVersion.versionName = versionName;
    modelVersion.versionDescription = versionDescription;
    modelVersion.algorithmVersion = algorithmVersion;

    await em.flush();
    return { id: modelVersion.id };
  });

export const deleteModelVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/models/{modelId}/versions/{versionId}",
      tags: ["modelVersion"],
      summary: "delete a new modelVersion",
    },
  })
  .input(z.object({
    versionId: z.number(),
    modelId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.object({ success: z.boolean() }))
  .use(async ({ input: { modelId, versionId }, ctx, next }) => {

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteModelVersion,
    };

    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });
    }

    const modelVersion = await em.findOne(ModelVersion, { id: versionId });
    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });

    const res = await next({ ctx });

    if (res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId,
          modelName: model.name,
          modelVersionName: modelVersion.versionName,
        },
      },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId,
          modelName: model.name,
          modelVersionName: modelVersion.versionName,
        },
      },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const modelVersion = await em.findOne(ModelVersion, { id: input.versionId });
    const isPlatformOwned = input.isPlatformOwned ?? false;

    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${input.versionId} not found` });

    const model = await em.findOne(Model, { id: input.modelId },
      { populate: ["versions", "versions.sharedStatus"] });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${input.modelId} not found` });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can delete platform owned model version",
        });
      }
    }

    if (!isPlatformOwned && model.owner !== user.identityId) {
      const detailMessage =
        `Model id:${input.modelId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    // 正在分享中或取消分享中的版本，不可删除
    if (modelVersion.sharedStatus === SharedStatus.SHARING
      || modelVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError(
        {
          code: "PRECONDITION_FAILED",
          message: `ModelVersion (id:${input.versionId}) is currently being shared or unshared`
        });
    }

    // 如果是已分享的模型版本，则删除分享; 如果是公共数据资产则不删除分享文件夹
    if (modelVersion.sharedStatus === SharedStatus.SHARED) {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, model.clusterId);

      if (!isPlatformOwned) {

        try {
          await driver.withFileDriver({
            clusterId: model.clusterId,
            user: user.identityId,
          }, async (fileDriver) => {
            await fileDriver.checkSharePermission(modelVersion.privatePath);
          }, logger);

          const pathToUnshare
            = model.versions.filter((v) => (v.id !== input.versionId && v.sharedStatus === SharedStatus.SHARED))
              .length > 0 ?
              // 除了此版本以外仍有其他已分享的版本则取消分享当前版本
              dirname(modelVersion.path)
              // 除了此版本以外没有其他已分享的版本则取消分享整个模型
              : dirname(dirname(modelVersion.path));

          await driver.withFileDriver({
            clusterId: model.clusterId,
            user: user.identityId,
          }, async (fileDriver) => {
            await fileDriver.unShareFileOrDir(pathToUnshare);
          }, logger);
        } catch (e) {
          logger.error(`ssh failure occured when unshare modelVersion ${input.versionId} of model ${input.modelId}`, e);
        }
      }

      model.isShared = model.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 1
        ? true : false;
      em.persist(model);
    }

    em.remove(modelVersion);
    await em.flush();
    return { success: true };
  });


export const shareModelVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/models/{modelId}/versions/{versionId}/share",
      tags: ["modelVersion"],
      summary: "share a modelVersion",
    },
  })
  .input(z.object({
    modelId: z.number(),
    versionId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.void())
  .use(async ({ input: { modelId, versionId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shareModelVersion,
    };

    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });
    }

    const modelVersion = await em.findOne(ModelVersion, { id: versionId });
    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });

    if (res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId,
          modelName: model.name,
          modelVersionName: modelVersion.versionName,
        },
      },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          modelId,
          versionId,
          modelName: model.name,
          modelVersionName: modelVersion.versionName,
        },
      },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input: { modelId, versionId, isPlatformOwned }, ctx: { user } }) => {
    const em = await forkEntityManager();
    ensureAiUserShareEnabled(isPlatformOwned);
    const modelVersion = await em.findOne(ModelVersion, { id: versionId });
    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${modelId} not found` });

    if (modelVersion.sharedStatus === SharedStatus.SHARED)
      throw new TRPCError({ code: "CONFLICT", message: "ModelVersion is already shared" });

    const model = await em.findOne(Model, { id: modelId });
    if (!model)
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can share platform owned model version",
        });
      }
    }

    if (!isPlatformOwned && model.owner !== user.identityId) {
      const detailMessage =
        `Model id:${modelId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, model.clusterId);

    // 若公共资产路径改变，则无法发布
    const checkIsPublicAssetModelVersion = checkIsPublicPaths(
      model.clusterId,
      [modelVersion.path],
    );

    if (isPlatformOwned && !checkIsPublicAssetModelVersion) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to model version files; publishing is not allowed.",
      });
    }

    await driver.withFileDriver({
      clusterId: model.clusterId,
      user: user.identityId,
    }, async (fileDriver) => {
      await fileDriver.checkSharePermission(modelVersion.privatePath, isPlatformOwned);
    }, logger);

    modelVersion.sharedStatus = SharedStatus.SHARING;
    em.persist([modelVersion]);
    await em.flush();

    if (isPlatformOwned) {
      const modelVersion = await em.findOne(ModelVersion, { id: versionId });
      if (!modelVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${modelId} not found` });

      const model = await em.findOne(Model, { id: modelId });
      if (!model)
        throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });

      modelVersion.sharedStatus = SharedStatus.SHARED;
      modelVersion.path = modelVersion.privatePath;
      if (!model.isShared) { model.isShared = true; };

      await em.persistAndFlush([modelVersion, model]);

      return;
    }

    const homeDir = await driver.withFileDriver({
      clusterId: model.clusterId,
      user: user.identityId,
    }, async (fileDriver) => {
      return await fileDriver.getHomeDirectory();
    }, logger);
    const sharedTopDir = buildSharedTopDir(model.clusterId, homeDir);


    const successCallback = async (targetFullPath: string) => {
      const em = await forkEntityManager();

      const modelVersion = await em.findOne(ModelVersion, { id: versionId });
      if (!modelVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${modelId} not found` });

      const model = await em.findOne(Model, { id: modelId });
      if (!model)
        throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });

      const versionPath = join(targetFullPath, path.basename(modelVersion.privatePath));
      modelVersion.sharedStatus = SharedStatus.SHARED;
      modelVersion.path = versionPath;
      if (!model.isShared) { model.isShared = true; };

      await em.persistAndFlush([modelVersion, model]);
    };

    const failureCallback = async () => {
      const em = await forkEntityManager();

      const modelVersion = await em.findOne(ModelVersion, { id: versionId });
      if (!modelVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${modelId} not found` });

      modelVersion.sharedStatus = SharedStatus.UNSHARED;
      await em.persistAndFlush([modelVersion]);
    };

    driver.withFileDriver({
      clusterId: model.clusterId,
      user: user.identityId,
    }, async (fileDriver) => {
      await fileDriver.shareFileOrDir({
        sourceFilePath: modelVersion.privatePath,
        sharedTarget: SHARED_TARGET.MODEL,
        targetName: model.name,
        targetSubName: modelVersion.versionName,
        sharedTopDir,
      }, successCallback, failureCallback);
    }, logger);

    return;
  });

export const unShareModelVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/models/{modelId}/versions/{versionId}/share",
      tags: ["modelVersion"],
      summary: "unshare a modelVersion",
    },
  })
  .input(z.object({
    versionId: z.number(),
    modelId: z.number(),
    isPlatformOwned: z.boolean().optional(),
  }))
  .output(z.void())
  .mutation(async ({ input: { versionId, modelId, isPlatformOwned }, ctx: { user } }) => {
    const em = await forkEntityManager();
    ensureAiUserShareEnabled(isPlatformOwned);
    const modelVersion = await em.findOne(ModelVersion, { id: versionId });
    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });

    if (modelVersion.sharedStatus === SharedStatus.UNSHARED)
      throw new TRPCError({ code: "CONFLICT", message: "ModelVersion is already unShared" });

    const model = await em.findOne(Model, { id: modelId }, {
      populate: ["versions.sharedStatus"],
    });
    if (!model)
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can unshare platform owned model version",
        });
      }
    }

    if (!isPlatformOwned && (model.owner !== user.identityId)) {
      const detailMessage =
        `Model id:${modelId} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, model.clusterId);

    modelVersion.sharedStatus = SharedStatus.UNSHARING;
    em.persist([modelVersion]);
    await em.flush();

    const successCallback = async () => {
      const em = await forkEntityManager();

      const modelVersion = await em.findOne(ModelVersion, { id: versionId });
      if (!modelVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });

      const model = await em.findOne(Model, { id: modelId }, {
        populate: ["versions.sharedStatus"],
      });
      if (!model)
        throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });

      modelVersion.sharedStatus = SharedStatus.UNSHARED;
      modelVersion.path = modelVersion.privatePath;
      model.isShared = model.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0
        ? true : false;

      await em.persistAndFlush([modelVersion, model]);
    };

    const failureCallback = async () => {
      const em = await forkEntityManager();

      const modelVersion = await em.findOne(ModelVersion, { id: versionId });
      if (!modelVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });
      modelVersion.sharedStatus = SharedStatus.SHARED;

      await em.persistAndFlush([modelVersion]);
    };

    if (isPlatformOwned) {
      await successCallback();
      return;
    }

    const sharedModelVersionPath =
      model.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
        // 如果还有其他的已分享版本则只取消此版本的分享
        dirname(modelVersion.path)
        // 如果没有其他的已分享版本则取消整个算法的分享
        : dirname(dirname(modelVersion.path));

    driver.withFileDriver({
      clusterId: model.clusterId,
      user: user.identityId,
    }, async (fileDriver) => {
      await fileDriver.unShareFileOrDir(sharedModelVersionPath, successCallback, failureCallback);
    }, logger);

    return;
  });

export const copyPublicModelVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/model/{modelId}/versions/{versionId}/copy",
      tags: ["modelVersion"],
      summary: "copy a public model version",
    },
  })
  .input(z.object({
    modelId: z.number(),
    versionId: z.number(),
    modelName: z.string(),
    versionName: z.string(),
    versionDescription: z.string(),
    path: z.string(),
  }))
  .output(z.object({ targetModelId: z.number(), targetModelVersionId: z.number() }))
  .use(async ({ input: { modelId, versionId, modelName, versionName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.copyModelVersion,
    };

    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: modelId });
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${modelId} not found` });
    }

    const modelVersion = await em.findOne(ModelVersion, { id: versionId });
    if (!modelVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `ModelVersion ${versionId} not found` });

    if (res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          sourceModelId: modelId,
          sourceModelVersionId: versionId,
          targetModelId: (res.data as any).targetModelId,
          targetModelVersionId: (res.data as any).targetModelVersionId,
          sourceModelName: model.name,
          sourceModelVersionName: modelVersion.versionName,
          targetModelName: modelName,
          targetModelVersionName: versionName,
        },
      },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({
        ...logInfo, operationTypePayload:
        {
          sourceModelId: modelId,
          sourceModelVersionId: versionId,
          sourceModelName: model.name,
          sourceModelVersionName: modelVersion.versionName,
          targetModelName: modelName,
          targetModelVersionName: versionName,
        },
      },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    // 1. 检查模型版本是否为公开版本
    const modelVersion = await em.findOne(ModelVersion,
      { id: input.versionId, sharedStatus: SharedStatus.SHARED },
      { populate: ["model"] });

    if (!modelVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Model Version ${input.versionId} does not exist or is not public`,
      });
    }
    // 2. 检查该用户是否已有同名模型
    const model = await em.findOne(Model, {
      name: input.modelName,
      owner: user.identityId,
      isPlatformOwned: false,
    });
    if (model) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `A model with the same name as ${input.modelName} already exists`,
      });
    }

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, modelVersion.model.$.clusterId);
    // 3. 检查用户是否能将源模型拷贝至目标目录
    await driver.withFileDriver({
      clusterId: modelVersion.model.$.clusterId,
      user: user.identityId,
    }, async (fileDriver) => {
      await fileDriver.checkCopyFilePath(input.path, path.basename(modelVersion.path));
    }, logger);

    // 3. 写入数据
    const newModel = new Model({
      name: input.modelName,
      owner: user.identityId,
      algorithmFramework: modelVersion.model.$.algorithmFramework,
      algorithmName: modelVersion.model.$.algorithmName,
      description: modelVersion.model.$.description,
      clusterId: modelVersion.model.$.clusterId,
    });

    const targetCopiedPath = path.join(input.path, path.basename(modelVersion.path));
    const newModelVersion = new ModelVersion({
      versionName: input.versionName,
      versionDescription: input.versionDescription,
      path: targetCopiedPath,
      privatePath: targetCopiedPath,
      algorithmVersion: modelVersion.algorithmVersion,
      model: newModel,
    });

    // 若公共资产路径改变，则无法复制
    const checkIsPublicPathsResult = checkIsPublicPaths(
      modelVersion.model.$.clusterId,
      [modelVersion.path],
    );

    if (!checkIsPublicPathsResult && modelVersion.model.$.isPlatformOwned === true) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to the model version files; copying is not allowed.",
      });
    }

    try {
      await withFileDriver(
        { clusterId: modelVersion.model.$.clusterId, user: user.identityId },
        async (driver) => {
          const cluster = clusters[modelVersion.model.$.clusterId];

          await driver.copy(modelVersion.path,
            cluster.scowd?.enabled ? targetCopiedPath : input.path,
            checkIsPublicPathsResult,
          );
        },
        logger,
      );
      // 递归修改文件权限和拥有者
      await withFileDriver(
        { clusterId: modelVersion.model.$.clusterId, user: user.identityId },
        async (driver) => {
          await driver.chmod(targetCopiedPath, "0750");
        },
        logger,
      );
      await em.persistAndFlush([newModel, newModelVersion]);
    } catch (err) {
      console.log(err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Copy Error ${err as any}`,
      });
    }

    return { targetModelId: newModel.id, targetModelVersionId: newModelVersion.id };
  });
