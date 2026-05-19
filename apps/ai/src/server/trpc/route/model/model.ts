import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { basename, dirname, join } from "path";
import { Framework } from "src/models/Algorithm";
import { SharedStatus } from "src/server/entities/AlgorithmVersion";
import { Model } from "src/server/entities/Model";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { PlatformRole } from "src/server/trpc/route/auth";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { getUsersName } from "src/server/utils/user";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";
import { driver } from "../../Driver";
import { booleanQueryParam, clusterExist } from "../utils";

export const ModelListSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.union([z.string(), z.undefined()]),
  algorithmName: z.string().optional(),
  algorithmFramework: z.enum(Framework).optional(),
  isShared: z.boolean(),
  versions: z.array(
    z.object({
      id: z.number(),
      path: z.string(),
    }),
  ),
  owner: z.string(),
  ownerName: z.string(),
  clusterId: z.string(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  versionsCount: z.number(),
  isPlatformOwned: z.boolean(),
});

export const list = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/models",
      tags: ["model"],
      summary: "list models",
    },
  })
  .input(
    z.object({
      ...paginationSchema.shape,
      nameOrDesc: z.string().optional(),
      isPublic: booleanQueryParam().optional(),
      clusterId: z.string().optional(),
      isPlatformOwned: z.boolean().optional(), // 是否为平台管理员公共数据资产
    }),
  )
  .output(z.object({ items: z.array(ModelListSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    // 如果查询某一个集群
    if (input.clusterId) {
      // 再次检查当前查询集群是否为在线可用集群
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, input.clusterId);
    }

    const em = await forkEntityManager();

    const { isPublic, nameOrDesc, clusterId, page, pageSize, isPlatformOwned } = input;

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can get platform owned model",
        });
      }
    }

    // 构建查询条件
    let isPublicQuery: any;

    if (isPlatformOwned) {
      // isPlatformOwned 为 true 时，公共数据资产只包含平台拥有的
      isPublicQuery = { isPlatformOwned: true };
    } else if (isPublic) {
      isPublicQuery = {
        isShared: true,
        owner: { $ne: null },
      };
    } else {
      isPublicQuery = {
        owner: user.identityId,
        isPlatformOwned: false,
      };
    }

    const nameOrDescQuery = nameOrDesc
      ? {
          $or: [{ name: { $like: `%${nameOrDesc}%` } }, { description: { $like: `%${nameOrDesc}%` } }],
        }
      : {};

    const clusterQuery = clusterId
      ? {
          clusterId,
        }
      : {};

    const [items, count] = await em.findAndCount(
      Model,
      {
        ...isPublicQuery,
        ...nameOrDescQuery,
        ...clusterQuery,
      },
      {
        ...paginationProps(page, pageSize),
        populate: ["versions.sharedStatus", "versions.privatePath"],
        orderBy: { createTime: "desc" },
      },
    );

    const ownerIds = Array.from(new Set(items.map((x) => x.owner)));

    let userMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const users = await getUsersName(ownerIds);
      userMap = users.reduce(
        (acc, user) => {
          acc[user.userId] = user.userName;
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    return {
      items: items.map((x) => {
        return {
          id: x.id,
          name: x.name,
          description: x.description,
          algorithmName: x.algorithmName,
          algorithmFramework: x.algorithmFramework,
          isShared: Boolean(x.isShared),
          versions: isPublic
            ? x.versions.filter((x) => x.sharedStatus === SharedStatus.SHARED).map((y) => ({ id: y.id, path: y.path }))
            : x.versions.map((y) => ({ id: y.id, path: y.privatePath })),
          owner: x.owner,
          clusterId: x.clusterId,
          createTime: x.createTime ? x.createTime.toISOString() : undefined,
          ownerName: userMap[x.owner] ?? x.owner,
          versionsCount: x.versions.length,
          updateTime: x.updateTime ? x.updateTime.toISOString() : undefined,
          isPlatformOwned: x.isPlatformOwned,
        };
      }),
      count,
    };
  });

export const createModel = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/models",
      tags: ["model"],
      summary: "Create a new model",
    },
  })
  .input(
    z.object({
      name: z.string(),
      algorithmName: z.string().optional(),
      algorithmFramework: z.enum(Framework).optional(),
      description: z.string().optional(),
      clusterId: z.string(),
      isPlatformOwned: z.boolean().optional(),
    }),
  )
  .output(z.number())
  .use(async ({ input: { clusterId, name }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createModel,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            modelId: res.data as number,
            modelName: name,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            modelName: name,
          },
        },
        OperationResult.FAIL,
      );
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

    const isPlatformOwned = input.isPlatformOwned ?? false;
    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can create platform owned model",
        });
      }
    }

    const em = await forkEntityManager();
    const modelExist = await em.findOne(
      Model,
      isPlatformOwned
        ? { name: input.name, isPlatformOwned: true }
        : { name: input.name, owner: user.identityId, isPlatformOwned: false },
    );
    if (modelExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `The current model name ${input.name} already exists`,
      });
    }

    const model = new Model({ ...input, owner: user.identityId, isShared: false });
    await em.persistAndFlush(model);
    return model.id;
  });

export const updateModel = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/models/{id}",
      tags: ["model"],
      summary: "update a model",
    },
  })
  .input(
    z.object({
      id: z.number(),
      name: z.string(),
      algorithmName: z.string().optional(),
      algorithmFramework: z.enum(Framework).optional(),
      description: z.string().optional(),
      isPlatformOwned: z.boolean().optional(),
    }),
  )
  .output(z.number())
  .use(async ({ input: { id, name }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateModel,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            modelId: id,
            modelName: name,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            modelId: id,
            modelName: name,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { id, name, algorithmName, algorithmFramework, description, isPlatformOwned = false } = input;

    const model = await em.findOne(Model, { id });

    if (!model) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Model (id:${id}) is not found`,
      });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can update platform owned model",
        });
      }
    }

    const modelExist = await em.findOne(
      Model,
      isPlatformOwned ? { name, isPlatformOwned: true } : { name, owner: user.identityId, isPlatformOwned: false },
    );

    if (modelExist && modelExist !== model) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Model name ${name} duplicated`,
      });
    }

    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${input.id} not found` });
    }

    if (!isPlatformOwned && model.owner !== user.identityId) {
      const detailMessage = `Model id:${input.id} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    const changingVersions = await em.find(ModelVersion, {
      model,
      $or: [{ sharedStatus: SharedStatus.SHARING }, { sharedStatus: SharedStatus.UNSHARING }],
    });
    if (changingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of model ${id} exists`,
      });
    }

    // 如果是已分享的模型且名称发生变化，则变更共享路径下的此模型名称为新名称
    if (model.isShared && name !== model.name && !isPlatformOwned) {
      const sharedVersions = await em.find(ModelVersion, { model, sharedStatus: SharedStatus.SHARED });
      const oldPath = dirname(dirname(sharedVersions[0].path));
      // 获取更新后的当前模型的共享路径名称
      const newModelSharedPath = await driver.withFileDriver(
        {
          clusterId: model.clusterId,
          user: user.identityId,
        },
        async (fileDriver) => {
          return await fileDriver.getUpdatedSharedPath(name, oldPath);
        },
        logger,
      );

      // 更新已分享的版本的共享文件夹地址
      sharedVersions.map((v) => {
        const baseFolderName = basename(v.path);
        const newPath = join(newModelSharedPath, v.versionName, baseFolderName);
        v.path = newPath;
      });
    }

    model.name = name;
    model.algorithmName = algorithmName;
    model.algorithmFramework = algorithmFramework;
    model.description = description;

    await em.flush();
    return model.id;
  });

export const deleteModel = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/models/{id}",
      tags: ["model"],
      summary: "delete a model",
    },
  })
  .input(z.object({ id: z.number(), isPlatformOwned: z.boolean().optional() }))
  .output(z.object({ success: z.boolean() }))
  .use(async ({ input: { id }, ctx, next }) => {
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteModel,
    };
    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id });

    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${id} not found` });
    }

    const res = await next({ ctx });

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            modelId: id,
            modelName: model.name,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            modelId: id,
            modelName: model.name,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: input.id });

    const isPlatformOwned = input.isPlatformOwned ?? false;

    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${input.id} not found` });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can delete platform owned model",
        });
      }
    }

    if (!isPlatformOwned && model.owner !== user.identityId) {
      const detailMessage = `Model id:${input.id} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The model asset does not belong to the current user.",
      });
    }

    const modelVersions = await em.find(ModelVersion, { model });

    const sharingVersions = modelVersions.filter(
      (v) => v.sharedStatus === SharedStatus.SHARING || v.sharedStatus === SharedStatus.UNSHARING,
    );

    // 有正在分享中或取消分享中的版本，则不可删除
    if (sharingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `There is a model version being shared or unshared of model ${input.id}`,
      });
    }

    const sharedVersions = modelVersions.filter((v) => v.sharedStatus === SharedStatus.SHARED);

    // 获取此模型的共享的模型绝对路径
    if (!isPlatformOwned && sharedVersions.length > 0) {
      const sharedModelPath = dirname(dirname(sharedVersions[0].path));

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, model.clusterId);

      const host = getClusterLoginNode(model.clusterId);
      if (!host) {
        throw clusterNotFound(model.clusterId);
      }

      await driver.withFileDriver(
        {
          clusterId: model.clusterId,
          user: user.identityId,
        },
        async (fileDriver) => {
          await fileDriver.unShareFileOrDir(sharedModelPath);
        },
        logger,
      );
    }

    await em.removeAndFlush([...modelVersions, model]);

    return { success: false };
  });
