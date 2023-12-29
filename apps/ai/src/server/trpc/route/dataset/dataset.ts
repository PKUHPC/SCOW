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

import { TRPCError } from "@trpc/server";
import { Dataset } from "src/server/entities/Dataset";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { procedure } from "src/server/trpc/procedure/base";
import { getORM } from "src/server/utils/getOrm";
import { unShareFile } from "src/server/utils/share";
import { z } from "zod";

// const mockDatasets = [
//   {
//     id: 100,
//     name: "aaa",
//     owner: "demo_admin",
//     type: "Image",
//     isShared: "true",
//     scene: "Text",
//     description: "test",
//     createTime: "2023-04-15 12:30:45",
//     versions: [100, 101],
//     clusterId: "hpc01",
//   },
//   {
//     id: 101,
//     name: "bbb",
//     owner: "demo_admin",
//     type: "Audio",
//     isShared: "false",
//     scene: "Text",
//     description: "test",
//     createTime: "2023-04-15 12:30:45",
//     versions: [],
//     clusterId: "hpc01",
//   },
// ];

export const DatasetListSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.string(),
  type: z.string(),
  isShared: z.boolean(),
  scene: z.string(),
  description: z.string().optional(),
  clusterId: z.string(),
  createTime: z.string(),
  versionsCount: z.number(),
});

export const list = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/dataset/list",
      tags: ["dataset"],
      summary: "Read all dataset",
    },
  })
  .input(z.object({
    page: z.number().min(1).optional(),
    pageSize: z.number().min(0).optional(),
    nameOrDesc: z.string().optional(),
    type: z.string().optional(),
    isShared: z.boolean().optional(),
    clusterId: z.string().optional(),
  }))
  .output(z.object({ items: z.array(DatasetListSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    const orm = await getORM();

    const isPublicQuery = input.isShared ? {
      isShared: true,
      owner: { $ne: null },
    } : { owner: user?.identityId };

    const nameOrDescQuery = input.nameOrDesc ? {
      $or: [
        { name: { $like: `%${input.nameOrDesc}%` } },
        { description: { $like: `%${input.nameOrDesc}%` } },
      ],
    } : {};

    const [items, count] = await orm.em.findAndCount(Dataset, {
      $and: [
        nameOrDescQuery,
        isPublicQuery,
        { type: input.type || { $ne: null },
          clusterId: input.clusterId,
        },
      ],
    }, {
      limit: input.pageSize || undefined,
      offset: input.page && input.pageSize ? ((input.page ?? 1) - 1) * input.pageSize : undefined,
      populate: ["versions", "versions.isShared"],
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
        createTime: x.createTime ? x.createTime.toISOString() : "",
        versionsCount: input.isShared ? x.versions.filter((x) => x.isShared).length : x.versions.count(),
      }; }), count };
  });


export const createDataset = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/dataset/create",
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
  .mutation(async ({ input, ctx: { user } }) => {
    const orm = await getORM();

    const dateSetExist = await orm.em.findOne(Dataset, { name:input.name, owner: user!.identityId });
    if (dateSetExist) {
      throw new TRPCError({
        code: "CONFLICT",
      });
    }
    // TODO: 判断集群是否可以连接？

    const dataset = new Dataset({ ...input, owner: user!.identityId });
    await orm.em.persistAndFlush(dataset);
    return dataset.id;
  });

export const updateDataset = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/dataset/update/{id}",
      tags: ["dataset"],
      summary: "update a dataset",
    },
  })
  .input(z.object({
    id: z.number(),
    clusterId: z.string(),
    name: z.string(),
    type: z.string(),
    scene: z.string(),
    description: z.string().optional(),
  }))
  .output(z.number())
  .mutation(async ({ input, ctx: { user } }) => {
    const orm = await getORM();
    const dataset = await orm.em.findOne(Dataset, { id: input.id });

    if (!dataset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Dataset ${input.id} not found`,
      });
    };

    // TODO: 判断集群是否可以连接？
    dataset.name = input.name;
    dataset.type = input.type;
    dataset.scene = input.scene;
    dataset.description = input.description;

    await orm.em.flush();
    return dataset.id;
  });

export const deleteDataset = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/dataset/delete/{id}",
      tags: ["dataset"],
      summary: "delete a dataset",
    },
  })
  .input(z.object({ id: z.number() }))
  .output(z.object({ success: z.boolean() }))
  .mutation(async ({ input, ctx: { user } }) => {
    const orm = await getORM();
    const dataset = await orm.em.findOne(Dataset, { id: input.id });
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${input.id} not found` });

    if (dataset.owner !== user?.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${input.id} not accessible` });

    const datasetVersions = await orm.em.find(DatasetVersion, { dataset });

    console.log("【datasetVersions】", datasetVersions);

    try {

      const sharedVersions = datasetVersions.filter((v) => v.isShared);
      console.log("【sharedV】", sharedVersions);
      // 删除所有已分享的版本创建的硬链接
      await Promise.all(sharedVersions.map(async (v) => {
        await unShareFile(dataset.clusterId, v.path, v.privatePath, user);
      })).catch((e) => {
        console.log(5555555, e);
      });

      await orm.em.removeAndFlush([...datasetVersions, dataset]);

      return { success: true };
    } catch (error) {
      // rollback
      console.error("Error deleting dataset:", error);
      return { success: false };
    }
  });
