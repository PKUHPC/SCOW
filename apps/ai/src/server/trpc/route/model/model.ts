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
import { basename, dirname, join } from "path";
import { Framework } from "src/models/Algorithm";
import { SharedStatus } from "src/server/entities/AlgorithmVersion";
import { Model } from "src/server/entities/Model";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { getClusterLoginNode } from "src/server/utils/ssh";
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
  algorithmFramework: z.nativeEnum(Framework).optional(),
  isShared: z.boolean(),
  versions: z.array(z.object({
    id: z.number(),
    path: z.string(),
  })),
  owner: z.string(),
  clusterId: z.string(),
  createTime: z.string().optional(),
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
  .input(z.object({
    ...paginationSchema.shape,
    nameOrDesc: z.string().optional(),
    isPublic: booleanQueryParam().optional(),
    clusterId: z.string().optional(),
  }))
  .output(z.object({ items: z.array(ModelListSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const isPublicQuery = input.isPublic ? {
      isShared: true,
    } : { owner: user.identityId };

    const nameOrDescQuery = input.nameOrDesc ? {
      $or: [
        { name: { $like: `%${input.nameOrDesc}%` } },
        { description: { $like: `%${input.nameOrDesc}%` } },
      ],
    } : {};

    const clusterQuery = input.clusterId ? {
      clusterId: input.clusterId,
    } : {};

    const [items, count] = await em.findAndCount(Model, {
      ...isPublicQuery,
      ...nameOrDescQuery,
      ...clusterQuery,
    }, {
      ...paginationProps(input.page, input.pageSize),
      populate: ["versions.sharedStatus", "versions.privatePath"],
      orderBy: { createTime: "desc" },
    });

    return { items: items.map((x) => {
      return {
        id: x.id,
        name: x.name,
        description: x.description,
        algorithmName: x.algorithmName,
        algorithmFramework: x.algorithmFramework,
        isShared: Boolean(x.isShared),
        versions: input.isPublic ?
          x.versions.filter((x) => (x.sharedStatus === SharedStatus.SHARED)).map((y) => ({ id: y.id, path: y.path }))
          : x.versions.map((y) => ({ id: y.id, path: y.privatePath })),
        owner: x.owner,
        clusterId: x.clusterId,
        createTime: x.createTime ? x.createTime.toISOString() : undefined,
      }; }), count };
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
  .input(z.object({
    name: z.string(),
    algorithmName: z.string().optional(),
    algorithmFramework: z.nativeEnum(Framework).optional(),
    description: z.string().optional(),
    clusterId: z.string(),
  }))
  .output(z.number())
  .use(async ({ input:{ clusterId,name }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createModel,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          clusterId,
          modelId:res.data as number,
          modelName: name,
        } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          clusterId,
          modelName: name,
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
    const modelExist = await em.findOne(Model, { name:input.name, owner: user.identityId });
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
  .input(z.object({
    id: z.number(),
    name: z.string(),
    algorithmName: z.string().optional(),
    algorithmFramework: z.nativeEnum(Framework).optional(),
    description: z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ id,name }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateModel,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          modelId:id,
          modelName:name,
        },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          modelId:id,
          modelName:name,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { id, name, algorithmName, algorithmFramework, description } = input;

    const model = await em.findOne(Model, { id });

    if (!model) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Model (id:${id}) is not found`,
      });
    }

    const modelExist = await em.findOne(Model, { name, owner: user.identityId });

    if (modelExist && modelExist !== model) {
      throw new TRPCError({
        code: "CONFLICT",
      });
    }

    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${input.id} not found` });
    }

    if (model.owner !== user.identityId) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Model ${input.id} not accessible` });
    }

    const changingVersions = await em.find(ModelVersion, { model,
      $or: [
        { sharedStatus: SharedStatus.SHARING },
        { sharedStatus: SharedStatus.UNSHARING },
      ]},
    );
    if (changingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of model ${id} exists`,
      });
    }

    // 如果是已分享的模型且名称发生变化，则变更共享路径下的此模型名称为新名称
    if (model.isShared && name !== model.name) {

      const sharedVersions = await em.find(ModelVersion, { model, sharedStatus: SharedStatus.SHARED });
      const oldPath = dirname(dirname(sharedVersions[0].path));
      // 获取更新后的当前模型的共享路径名称
      const newModelSharedPath = await driver.withFileDriver({
        clusterId:model.clusterId,
        user:user.identityId,
      }, async (fileDriver) => {
        return await fileDriver.getUpdatedSharedPath(name,oldPath);
      }, logger);

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
  .input(z.object({ id: z.number() }))
  .output(z.object({ success: z.boolean() }))
  .use(async ({ input:{ id }, ctx, next }) => {

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
      await callLog({ ...logInfo, operationTypePayload:
        {
          modelId:id,
          modelName:model.name,
        },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        {
          modelId:id,
          modelName:model.name,
        },
      },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const model = await em.findOne(Model, { id: input.id });

    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Model ${input.id} not found` });
    }

    if (model.owner !== user.identityId) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Model ${input.id} not accessible` });
    }
    const modelVersions = await em.find(ModelVersion, { model });

    const sharingVersions = modelVersions.filter(
      (v) => (v.sharedStatus === SharedStatus.SHARING || v.sharedStatus === SharedStatus.UNSHARING));

    // 有正在分享中或取消分享中的版本，则不可删除
    if (sharingVersions.length > 0) {
      throw new TRPCError(
        { code: "PRECONDITION_FAILED",
          message: `There is a model version being shared or unshared of model ${input.id}` });
    }

    const sharedVersions = modelVersions.filter((v) => (v.sharedStatus === SharedStatus.SHARED));

    // 获取此模型的共享的模型绝对路径
    if (sharedVersions.length > 0) {
      const sharedModelPath = dirname(dirname(sharedVersions[0].path));

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, model.clusterId);

      const host = getClusterLoginNode(model.clusterId);
      if (!host) { throw clusterNotFound(model.clusterId); }

      await driver.withFileDriver({
        clusterId:model.clusterId,
        user:user.identityId,
      }, async (fileDriver) => {
        await fileDriver.unShareFileOrDir(sharedModelPath);
      }, logger);
    }

    await em.removeAndFlush([...modelVersions, model]);

    return { success: false };
  });

