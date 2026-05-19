import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { basename, dirname, join } from "path";
import { SharedStatus } from "src/server/entities/AlgorithmVersion";
import { Dataset } from "src/server/entities/Dataset";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
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

export const DatasetListSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.string(),
  ownerName: z.string(),
  type: z.string(),
  isShared: z.boolean(),
  scene: z.string(),
  description: z.string().optional(),
  clusterId: z.string(),
  createTime: z.string().optional(),
  versions: z.array(
    z.object({
      id: z.number(),
      path: z.string(),
    }),
  ),
  updateTime: z.string().optional(),
  versionsCount: z.number(),
  isPlatformOwned: z.boolean(),
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
  .input(
    z.object({
      ...paginationSchema.shape,
      nameOrDesc: z.string().optional(),
      type: z.string().optional(),
      isPublic: booleanQueryParam().optional(),
      isPlatformOwned: z.boolean().optional(), // 是否为平台管理员公共数据资产
      clusterId: z.string().optional(),
    }),
  )
  .output(z.object({ items: z.array(DatasetListSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    const { page, pageSize, nameOrDesc, type, isPublic, isPlatformOwned, clusterId } = input;
    // 如果查询某一个集群
    if (clusterId) {
      // 再次检查当前查询集群是否为在线可用集群
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);
    }

    const em = await forkEntityManager();

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can get platform owned dataset",
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

    const [items, count] = await em.findAndCount(
      Dataset,
      {
        $and: [nameOrDescQuery, isPublicQuery, { ...(type ? { type } : {}), ...(clusterId ? { clusterId } : {}) }],
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
          owner: x.owner,
          ownerName: userMap[x.owner] ?? x.owner,
          type: x.type,
          isShared: Boolean(x.isShared),
          scene: x.scene,
          description: x.description,
          clusterId: x.clusterId,
          createTime: x.createTime ? x.createTime.toISOString() : undefined,
          updateTime: x.updateTime ? x.updateTime.toISOString() : undefined,
          versions: isPublic
            ? x.versions.filter((x) => x.sharedStatus === SharedStatus.SHARED).map((y) => ({ id: y.id, path: y.path }))
            : x.versions.map((y) => ({ id: y.id, path: y.privatePath })),
          versionsCount: x.versions.length,
          isPlatformOwned: x.isPlatformOwned,
        };
      }),
      count,
    };
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
  .input(
    z.object({
      name: z.string(),
      type: z.string(),
      scene: z.string(),
      clusterId: z.string(),
      description: z.string().optional(),
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
      operationTypeName: OperationType.createDataset,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            datasetId: res.data as number,
            datasetName: name,
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
            datasetName: name,
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
          message: "Only platform admin can create platform owned dataset",
        });
      }
    }

    const em = await forkEntityManager();

    const datesetExist = await em.findOne(
      Dataset,
      isPlatformOwned
        ? { name: input.name, isPlatformOwned: true }
        : { name: input.name, owner: user.identityId, isPlatformOwned: false },
    );

    if (datesetExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Dataset name ${input.name} already exist`,
      });
    }

    const dataset = new Dataset({ ...input, owner: user.identityId, isPlatformOwned });
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
  .input(
    z.object({
      id: z.number(),
      name: z.string(),
      type: z.string(),
      scene: z.string(),
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
      operationTypeName: OperationType.updateDataset,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            datasetId: id,
            datasetName: name,
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
            datasetId: id,
            datasetName: name,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { id, name, type, scene, description, isPlatformOwned = false } = input;

    const dataset = await em.findOne(Dataset, { id });

    if (!dataset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Dataset ${id} not found`,
      });
    }

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can update platform owned dataset",
        });
      }
    }

    if (!isPlatformOwned && dataset.owner !== user.identityId) {
      const detailMessage = `Dataset id:${id} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The dataset asset does not belong to the current user.",
      });
    }

    const nameExist = await em.findOne(
      Dataset,
      isPlatformOwned
        ? { name, id: { $ne: input.id }, isPlatformOwned: true }
        : { name, owner: user.identityId, id: { $ne: input.id }, isPlatformOwned: false },
    );
    if (nameExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Dataset name ${name} duplicated`,
      });
    }

    // 存在正在分享或正在取消分享的数据集版本，则不可更新名称
    const changingVersions = await em.find(DatasetVersion, {
      dataset,
      $or: [{ sharedStatus: SharedStatus.SHARING }, { sharedStatus: SharedStatus.UNSHARING }],
    });
    if (changingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of dataset ${id} exists`,
      });
    }

    // 如果是已分享的个人数据集且名称发生变化，则变更共享路径下的此数据集名称为新名称
    if (dataset.isShared && name !== dataset.name && !isPlatformOwned) {
      const sharedVersions = await em.find(DatasetVersion, { dataset, sharedStatus: SharedStatus.SHARED });
      const oldPath = dirname(dirname(sharedVersions[0].path));

      // 获取更新后的当前数据集的共享路径名称
      const newDatasetSharedPath = await driver.withFileDriver(
        {
          clusterId: dataset.clusterId,
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
  .input(z.object({ id: z.number(), isPlatformOwned: z.boolean().optional() }))
  .output(z.void())
  .use(async ({ input: { id }, ctx, next }) => {
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteDataset,
    };
    const em = await forkEntityManager();
    const dataset = await em.findOne(Dataset, { id });
    if (!dataset) throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${id} not found` });

    const res = await next({ ctx });

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            datasetId: id,
            datasetName: dataset.name,
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
            datasetId: id,
            datasetName: dataset.name,
          },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const { id, isPlatformOwned } = input;
    const em = await forkEntityManager();
    const dataset = await em.findOne(Dataset, { id });
    if (!dataset) throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${input.id} not found` });

    if (isPlatformOwned) {
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);
      if (!isPlatformAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only platform admin can delete platform owned dataset",
        });
      }
    }

    if (!isPlatformOwned && dataset.owner !== user.identityId) {
      const detailMessage = `Dataset id:${input.id} is not owned by current user. currentUserId:${user.identityId}`;
      logger.error(detailMessage);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Operation failed: The dataset asset does not belong to the current user.",
      });
    }

    const datasetVersions = await em.find(DatasetVersion, { dataset });

    const sharingVersions = datasetVersions.filter(
      (v) => v.sharedStatus === SharedStatus.SHARING || v.sharedStatus === SharedStatus.UNSHARING,
    );

    // 有正在分享中或取消分享中的版本，则不可删除
    if (sharingVersions.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `There is an dataset version  being shared or unshared of dataset ${input.id}`,
      });
    }

    const sharedVersions = datasetVersions.filter((v) => v.sharedStatus === SharedStatus.SHARED);

    // 获取此数据集的共享的数据集绝对路径, 删除分享路径文件夹
    if (!isPlatformOwned && sharedVersions.length > 0) {
      const sharedDatasetPath = dirname(dirname(sharedVersions[0].path));

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, dataset.clusterId);

      const host = getClusterLoginNode(dataset.clusterId);
      if (!host) {
        throw clusterNotFound(dataset.clusterId);
      }

      await driver.withFileDriver(
        {
          clusterId: dataset.clusterId,
          user: user.identityId,
        },
        async (fileDriver) => {
          await fileDriver.unShareFileOrDir(sharedDatasetPath);
        },
        logger,
      );
    }

    await em.removeAndFlush([...datasetVersions, dataset]);

    return;
  });
