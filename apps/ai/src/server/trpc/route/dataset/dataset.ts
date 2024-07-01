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
import { SharedStatus } from "src/server/entities/AlgorithmVersion";
import { Dataset } from "src/server/entities/Dataset";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { getUpdatedSharedPath, unShareFileOrDir } from "src/server/utils/share";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { booleanQueryParam, clusterExist } from "../utils";

export const DatasetListSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.string(),
  type: z.string(),
  isShared: z.boolean(),
  scene: z.string(),
  description: z.string().optional(),
  clusterId: z.string(),
  createTime: z.string().optional(),
  versions: z.array(z.object({
    id: z.number(),
    path: z.string(),
  })),
});

export type DatasetInterface = z.infer<typeof DatasetListSchema>;

export const list = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/datasets",
      tags: ["dataset"],
      summary: "Read all dataset",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    nameOrDesc: z.string().optional(),
    type: z.string().optional(),
    isPublic: booleanQueryParam().optional(),
    clusterId: z.string().optional(),
  }))
  .output(z.object({ items: z.array(DatasetListSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { page, pageSize, nameOrDesc, type, isPublic, clusterId } = input;

    const isPublicQuery = isPublic ? {
      isShared: true,
      owner: { $ne: null },
    } : { owner: user.identityId };

    const nameOrDescQuery = nameOrDesc ? {
      $or: [
        { name: { $like: `%${nameOrDesc}%` } },
        { description: { $like: `%${nameOrDesc}%` } },
      ],
    } : {};

    const [items, count] = await em.findAndCount(Dataset, {
      $and: [
        nameOrDescQuery,
        isPublicQuery,
        { ...type ? { type } : {},
          ...clusterId ? { clusterId } : {},
        },
      ],
    }, {
      ...paginationProps(page, pageSize),
      populate: ["versions.sharedStatus", "versions.privatePath"],
      orderBy: { createTime: "desc" },
    });

    return { items: items.map((x) => {
      return {
        id: x.id,
        name: x.name,
        owner: x.owner,
        type: x.type,
        isShared: Boolean(x.isShared),
        scene: x.scene,
        description: x.description,
        clusterId: x.clusterId,
        createTime: x.createTime ? x.createTime.toISOString() : undefined,
        versions: isPublic ?
          x.versions.filter((x) => (x.sharedStatus === SharedStatus.SHARED)).map((y) => ({ id: y.id, path: y.path }))
          : x.versions.map((y) => ({ id: y.id, path: y.privatePath })),
      }; }), count };
  });


export const createDataset = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/datasets",
      tags: ["dataset"],
      summary: "Create a new dataset",
    },
  })
  .input(z.object({
    name: z.string(),
    type: z.string(),
    scene: z.string(),
    clusterId: z.string(),
    description: z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ clusterId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createDataset,
    };
    console.log(111);
    if (res.ok) {
      console.log(222);
      await callLog({ ...logInfo, operationTypePayload:{ clusterId, datasetId:res.data as number } },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ clusterId } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {

    if (!clusterExist(input.clusterId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cluster id ${input.clusterId} does not exist.`,
      });
    }

    const em = await forkEntityManager();

    const datesetExist = await em.findOne(Dataset, { name:input.name, owner: user!.identityId });
    if (datesetExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Dataset name ${input.name} already exist`,
      });
    }

    const dataset = new Dataset({ ...input, owner: user!.identityId });
    await em.persistAndFlush(dataset);
    return dataset.id;
  });

export const updateDataset = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/datasets/{id}",
      tags: ["dataset"],
      summary: "update a dataset",
    },
  })
  .input(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    scene: z.string(),
    description: z.string().optional(),
  }))
  .output(z.number())
  .use(async ({ input:{ id }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateDataset,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ datasetId:id } },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ datasetId:id } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { id, name, type, scene, description } = input;

    const dataset = await em.findOne(Dataset, { id });

    if (!dataset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Dataset ${id} not found`,
      });
    };

    if (dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${id} not accessible` });

    const nameExist = await em.findOne(Dataset, {
      name,
      owner: user.identityId,
      id: { $ne: input.id },
    });
    if (nameExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Dataset name ${name} duplicated`,
      });
    }

    // 存在正在分享或正在取消分享的数据集版本，则不可更新名称
    const changingVersions = await em.find(DatasetVersion, { dataset,
      $or: [
        { sharedStatus: SharedStatus.SHARING },
        { sharedStatus: SharedStatus.UNSHARING },
      ]},
    );
    if (changingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of dataset ${id} exists`,
      });
    }

    // 如果是已分享的数据集且名称发生变化，则变更共享路径下的此数据集名称为新名称
    if (dataset.isShared && name !== dataset.name) {

      const sharedVersions = await em.find(DatasetVersion, { dataset, sharedStatus: SharedStatus.SHARED });
      const oldPath = dirname(dirname(sharedVersions[0].path));

      // 获取更新后的当前数据集的共享路径名称
      const newDatasetSharedPath = await getUpdatedSharedPath({
        clusterId: dataset.clusterId,
        newName: name,
        oldPath,
      });

      // 更新已分享的版本的共享文件夹地址
      sharedVersions.map((v) => {
        const baseFolderName = basename(v.path);
        const newPath = join(newDatasetSharedPath, v.versionName, baseFolderName);

        v.path = newPath;
      });

    }

    dataset.name = name;
    dataset.type = type;
    dataset.scene = scene;
    dataset.description = description;

    await em.flush();

    return dataset.id;
  });

export const deleteDataset = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/datasets/{id}",
      tags: ["dataset"],
      summary: "delete a dataset",
    },
  })
  .input(z.object({ id: z.number() }))
  .output(z.void())
  .use(async ({ input:{ id }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteDataset,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ datasetId:id } },
        OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{ datasetId:id } },
        OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const dataset = await em.findOne(Dataset, { id: input.id });
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${input.id} not found` });

    if (dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${input.id} not accessible` });

    const datasetVersions = await em.find(DatasetVersion, { dataset });

    const sharingVersions = datasetVersions.filter(
      (v) => (v.sharedStatus === SharedStatus.SHARING || v.sharedStatus === SharedStatus.UNSHARING));

    // 有正在分享中或取消分享中的版本，则不可删除
    if (sharingVersions.length > 0) {
      throw new TRPCError(
        { code: "PRECONDITION_FAILED",
          message: `There is an dataset version  being shared or unshared of dataset ${input.id}` });
    }

    const sharedVersions = datasetVersions.filter((v) => (v.sharedStatus === SharedStatus.SHARED));

    // 获取此数据集的共享的数据集绝对路径
    if (sharedVersions.length > 0) {
      const sharedDatasetPath = dirname(dirname(sharedVersions[0].path));

      const host = getClusterLoginNode(dataset.clusterId);
      if (!host) { throw clusterNotFound(dataset.clusterId); }

      await unShareFileOrDir({
        host,
        sharedPath: sharedDatasetPath,
      }).catch((e) => {
        console.error("Error deleting dataVersions of dataset:", e);
      });
    }

    await em.removeAndFlush([...datasetVersions, dataset]);

    return;
  });
