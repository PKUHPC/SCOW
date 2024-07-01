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
import { getUserHomedir, sftpExists } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import path, { basename, dirname, join } from "path";
import { SharedStatus } from "src/models/common";
import { Dataset } from "src/server/entities/Dataset";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCopyFilePath, checkCreateResourcePath } from "src/server/utils/checkPathPermission";
import { chmod } from "src/server/utils/chmod";
import { copyFile } from "src/server/utils/copyFile";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { paginationProps } from "src/server/utils/orm";
import { paginationSchema } from "src/server/utils/pagination";
import { checkSharePermission, getUpdatedSharedPath, SHARED_TARGET,
  shareFileOrDir, unShareFileOrDir } from "src/server/utils/share";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { booleanQueryParam } from "../utils";

export const DatasetVersionListSchema = z.object({
  id: z.number(),
  versionName: z.string(),
  sharedStatus: z.nativeEnum(SharedStatus),
  versionDescription: z.string().optional(),
  path: z.string(),
  privatePath: z.string(),
  createTime: z.string().optional(),
  datasetId: z.number(),
});

export type DatasetVersionInterface = z.infer<typeof DatasetVersionListSchema>;

export const versionList = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/datasets/{datasetId}/versions",
      tags: ["datasetVersion"],
      summary: "Read all datasetVersions",
    },
  })
  .input(z.object({
    ...paginationSchema.shape,
    datasetId: z.number(),
    isPublic: booleanQueryParam().optional(),
  }))
  .output(z.object({ items: z.array(DatasetVersionListSchema), count: z.number() }))
  .query(async ({ input }) => {
    const em = await forkEntityManager();

    const { page, pageSize, datasetId, isPublic } = input;

    const [items, count] = await em.findAndCount(DatasetVersion,
      {
        dataset: datasetId,
        ...isPublic ? { sharedStatus:SharedStatus.SHARED } : {},
      },
      {
        ...paginationProps(page, pageSize),
        orderBy: { createTime: "desc" },
      });

    return { items: items.map((x) => {
      return {
        id: x.id,
        versionName: x.versionName,
        versionDescription: x.versionDescription,
        privatePath: x.privatePath,
        path: x.path,
        sharedStatus: x.sharedStatus,
        createTime: x.createTime ? x.createTime.toISOString() : undefined,
        datasetId: x.dataset.id,
      }; }), count };
  });

export const createDatasetVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/datasets/{datasetId}/versions",
      tags: ["datasetVersion"],
      summary: "Create a new datasetVersion",
    },
  })
  .input(z.object({
    versionName: z.string(),
    path: z.string(),
    versionDescription: z.string().optional(),
    datasetId: z.number(),
  }))
  .output(z.object({ datasetVersionId: z.number() }))
  .use(async ({ input:{ datasetId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createDatasetVersion,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:(res.data as any).datasetVersionId } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const { versionName, path, datasetId } = input;

    const dataset = await em.findOne(Dataset, { id: datasetId });
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

    const nameExist = await em.findOne(DatasetVersion, { versionName: versionName, dataset: dataset });
    if (nameExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `DatasetVersion name ${versionName} duplicated`,
      });
    }

    if (dataset && dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${datasetId} not accessible` });

    // 检查目录是否存在
    const host = getClusterLoginNode(dataset.clusterId);

    if (!host) { throw clusterNotFound(dataset.clusterId); }

    await checkCreateResourcePath({ host, userIdentityId: user.identityId, toPath: input.path });

    await sshConnect(host, user.identityId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      if (!(await sftpExists(sftp, path))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${path} does not exists` });
      }
    });

    const datasetVersion = new DatasetVersion({ ...input, privatePath: path, dataset: dataset });
    await em.persistAndFlush(datasetVersion);
    return { datasetVersionId: datasetVersion.id };
  });

export const updateDatasetVersion = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/datasets/{datasetId}/versions/{datasetVersionId}",
      tags: ["dataset"],
      summary: "update a dataset",
    },
  })
  .input(z.object({
    datasetVersionId: z.number(),
    versionName: z.string(),
    versionDescription: z.string().optional(),
    datasetId: z.number(),
  }))
  .output(z.number())
  .use(async ({ input:{ datasetId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.updateDatasetVersion,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:res.data as number } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:0 } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    const { datasetVersionId, versionName, versionDescription, datasetId } = input;

    const dataset = await em.findOne(Dataset, { id: datasetId });
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

    if (dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${datasetVersionId} not accessible` });

    const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
    if (!datasetVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

    const nameExist = await em.findOne(DatasetVersion,
      { versionName,
        dataset,
        id: { $ne: datasetVersionId },
      });
    if (nameExist) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `DatasetVersion name ${versionName} duplicated`,
      });
    }

    if (datasetVersion.sharedStatus === SharedStatus.SHARING ||
      datasetVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of datasetVersion ${datasetVersionId} exists`,
      });
    }

    const needUpdateSharedPath = datasetVersion.sharedStatus === SharedStatus.SHARED
      && versionName !== datasetVersion.versionName;

    // 更新已分享目录下的版本路径名称
    if (needUpdateSharedPath) {
      // 获取更新后的已分享版本路径
      const newVersionSharedPath = await getUpdatedSharedPath({
        clusterId: dataset.clusterId,
        newName: versionName,
        oldPath: dirname(datasetVersion.path),
      });

      const baseFolderName = basename(datasetVersion.path);

      datasetVersion.path = join(newVersionSharedPath, baseFolderName);
    }

    datasetVersion.versionName = versionName;
    datasetVersion.versionDescription = versionDescription;

    await em.flush();

    return datasetVersion.id;
  });

export const deleteDatasetVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/datasets/{datasetId}/versions/{datasetVersionId}",
      tags: ["datasetVersion"],
      summary: "delete a new datasetVersion",
    },
  })
  .input(z.object({
    datasetVersionId: z.number(),
    datasetId: z.number(),
  }))
  .output(z.void())
  .use(async ({ input:{ datasetId, datasetVersionId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.deleteDatasetVersion,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:datasetVersionId } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:datasetVersionId } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const { datasetVersionId, datasetId } = input;
    const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });

    if (!datasetVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

    const dataset = await em.findOne(Dataset, { id: datasetId },
      { populate: ["versions", "versions.sharedStatus"]});
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

    if (dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${datasetId} not accessible` });

    // 正在分享中或取消分享中的版本，不可删除
    if (datasetVersion.sharedStatus === SharedStatus.SHARING
      || datasetVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError(
        { code: "PRECONDITION_FAILED",
          message: `DatasetVersion (id:${datasetVersionId}) is currently being shared or unshared` });
    }

    // 如果是已分享的数据集版本，则删除分享
    if (datasetVersion.sharedStatus === SharedStatus.SHARED) {

      try {
        const host = getClusterLoginNode(dataset.clusterId);
        if (!host) { throw clusterNotFound(dataset.clusterId); }

        await sshConnect(host, user.identityId, logger, async (ssh) => {
          await checkSharePermission({
            ssh,
            logger,
            sourcePath: datasetVersion.privatePath,
            userId: user.identityId,
          });
        });
        const pathToUnshare
        = dataset.versions.filter((v) =>
          (v.id !== datasetVersionId && v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
          // 除了此版本以外仍有其他已分享的版本则取消分享当前版本
          dirname(datasetVersion.path)
          // 除了此版本以外没有其他已分享的版本则取消分享整个数据集
          : dirname(dirname(datasetVersion.path));

        await unShareFileOrDir({
          host,
          sharedPath: pathToUnshare,
        });

      } catch (e) {
        logger.error(`ssh failure occured when unshare datasetVersion ${datasetVersionId} of dataset ${datasetId} `, e);
      }

      dataset.isShared = dataset.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 1
        ? true : false;
      em.persist(dataset);
    }

    em.remove(datasetVersion);
    await em.flush();
    return;
  });

export const shareDatasetVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/datasets/{datasetId}/versions/{datasetVersionId}/share",
      tags: ["datasetVersion"],
      summary: "share a datasetVersion",
    },
  })
  .input(z.object({
    datasetVersionId: z.number(),
    datasetId: z.number(),
  }))
  .output(z.void())
  .use(async ({ input:{ datasetId, datasetVersionId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shareDatasetVersion,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:datasetVersionId } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { datasetId, versionId:datasetVersionId } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const { datasetVersionId, datasetId } = input;
    const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
    if (!datasetVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

    if (datasetVersion.sharedStatus === SharedStatus.SHARED)
      throw new TRPCError({ code: "CONFLICT", message: "DatasetVersion is already shared" });

    const dataset = await em.findOne(Dataset, { id: datasetId });
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

    if (dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${datasetId} not accessible` });


    const host = getClusterLoginNode(dataset.clusterId);
    if (!host) { throw clusterNotFound(dataset.clusterId); }

    const homeTopDir = await sshConnect(host, user.identityId, logger, async (ssh) => {
      // 确认是否具有分享权限
      await checkSharePermission({ ssh, logger, sourcePath: datasetVersion.privatePath, userId: user.identityId });
      // 获取分享路径的上级路径
      const userHomeDir = await getUserHomedir(ssh, user.identityId, logger);
      return dirname(dirname(userHomeDir));
    });

    datasetVersion.sharedStatus = SharedStatus.SHARING;
    em.persist([datasetVersion]);
    await em.flush();

    const successCallback = async (targetFullPath: string) => {
      const em = await forkEntityManager();

      const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
      if (!datasetVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

      const dataset = await em.findOne(Dataset, { id: datasetId });
      if (!dataset)
        throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

      const versionPath = join(targetFullPath, path.basename(datasetVersion.privatePath));
      datasetVersion.sharedStatus = SharedStatus.SHARED;
      datasetVersion.path = versionPath;
      if (!dataset.isShared) { dataset.isShared = true; };

      await em.persistAndFlush([datasetVersion, dataset]);
    };

    const failureCallback = async () => {
      const em = await forkEntityManager();

      const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
      if (!datasetVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

      datasetVersion.sharedStatus = SharedStatus.UNSHARED;
      await em.persistAndFlush([datasetVersion]);
    };

    shareFileOrDir({
      clusterId: dataset.clusterId,
      sourceFilePath: datasetVersion.privatePath,
      userId: user.identityId,
      sharedTarget: SHARED_TARGET.DATASET,
      targetName: dataset.name,
      targetSubName: datasetVersion.versionName,
      homeTopDir,
    }, successCallback, failureCallback);

    await em.flush();
    return;
  });

export const unShareDatasetVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/datasets/{datasetId}/versions/{datasetVersionId}/share",
      tags: ["datasetVersion"],
      summary: "unshare a datasetVersion",
    },
  })
  .input(z.object({
    datasetVersionId: z.number(),
    datasetId: z.number(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();
    const { datasetVersionId, datasetId } = input;
    const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
    if (!datasetVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

    if (datasetVersion.sharedStatus === SharedStatus.UNSHARED)
      throw new TRPCError({ code: "CONFLICT", message: "DatasetVersion is already unShared" });

    const dataset = await em.findOne(Dataset, { id: datasetId }, {
      populate: ["versions.sharedStatus"],
    });
    if (!dataset)
      throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

    if (dataset.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Dataset ${datasetId} not accessible` });

    const host = getClusterLoginNode(dataset.clusterId);
    if (!host) { throw clusterNotFound(dataset.clusterId); }

    await sshConnect(host, user.identityId, logger, async (ssh) => {
      await checkSharePermission({
        ssh,
        logger,
        sourcePath: datasetVersion.privatePath,
        userId: user.identityId,
      });
    });

    datasetVersion.sharedStatus = SharedStatus.UNSHARING;
    em.persist([datasetVersion]);
    await em.flush();

    const successCallback = async () => {
      const em = await forkEntityManager();

      const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
      if (!datasetVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

      const dataset = await em.findOne(Dataset, { id: datasetId }, {
        populate: ["versions.sharedStatus"],
      });
      if (!dataset)
        throw new TRPCError({ code: "NOT_FOUND", message: `Dataset ${datasetId} not found` });

      datasetVersion.sharedStatus = SharedStatus.UNSHARED;
      datasetVersion.path = datasetVersion.privatePath;
      dataset.isShared = dataset.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0
        ? true : false;

      await em.persistAndFlush([datasetVersion, dataset]);
    };

    const failureCallback = async () => {
      const em = await forkEntityManager();

      const datasetVersion = await em.findOne(DatasetVersion, { id: datasetVersionId });
      if (!datasetVersion)
        throw new TRPCError({ code: "NOT_FOUND", message: `DatasetVersion ${datasetVersionId} not found` });

      datasetVersion.sharedStatus = SharedStatus.SHARED;
      await em.persistAndFlush([datasetVersion]);
    };

    unShareFileOrDir({
      host,
      sharedPath: dataset.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
        // 如果还有其他的已分享版本则只取消此版本的分享
        dirname(datasetVersion.path)
        // 如果没有其他的已分享版本则取消整个数据集的分享
        : dirname(dirname(datasetVersion.path)),
    }, successCallback, failureCallback);

    await em.flush();
    return;
  });

export const copyPublicDatasetVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/datasets/{datasetId}/versions/{datasetVersionId}/copy",
      tags: ["datasetVersion"],
      summary: "copy a public dataset version",
    },
  })
  .input(z.object({
    datasetId: z.number(),
    datasetVersionId: z.number(),
    datasetName: z.string(),
    versionName: z.string(),
    versionDescription: z.string(),
    path: z.string(),
  }))
  .output(z.object({ newDatasetId: z.number(), newDatasetVersionId: z.number() }))
  .use(async ({ input:{ datasetId, datasetVersionId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.copyDatasetVersion,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { sourceDatasetId:datasetId, sourceDatasetVersionId:datasetVersionId,
          targetDatasetId:(res.data as any).newDatasetId,
          targetDatasetVersionId:(res.data as any).newDatasetVersionId } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { sourceDatasetId:datasetId, sourceDatasetVersionId:datasetVersionId } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const em = await forkEntityManager();

    // 1. 检查数据集版本是否为公开版本
    const datasetVersion = await em.findOne(DatasetVersion,
      { id: input.datasetVersionId, sharedStatus: SharedStatus.SHARED },
      { populate: ["dataset"]});

    if (!datasetVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Dataset Version ${input.datasetVersionId} does not exist or is not public`,
      });
    }
    // 2. 检查该用户是否已有同名数据集
    const dataset = await em.findOne(Dataset, { name: input.datasetName, owner: user.identityId });
    if (dataset) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `A dataset with the same name as ${input.datasetName} already exists`,
      });
    }

    // 3. 检查用户是否可以将源文件复制到目标文件
    const host = getClusterLoginNode(datasetVersion.dataset.$.clusterId);

    if (!host) { throw clusterNotFound(datasetVersion.dataset.$.clusterId); }

    await checkCopyFilePath({ host, userIdentityId: user.identityId,
      toPath: input.path, fileName: path.basename(datasetVersion.path) });

    // 4. 写入数据
    const newDataset = new Dataset({
      name: input.datasetName,
      owner: user.identityId,
      type: datasetVersion.dataset.$.type,
      scene: datasetVersion.dataset.$.scene,
      description: datasetVersion.dataset.$.description,
      clusterId: datasetVersion.dataset.$.clusterId,
    });

    const newDatasetVersion = new DatasetVersion({
      versionName: input.versionName,
      versionDescription: input.versionDescription,
      path: input.path,
      privatePath: input.path,
      dataset: newDataset,
    });

    try {
      await copyFile({ host, userIdentityId: user.identityId,
        fromPath: datasetVersion.path, toPath: input.path });
      // 递归修改文件权限和拥有者
      await chmod({ host, userIdentityId: "root", permission: "750", path: input.path });
      await em.persistAndFlush([newDataset, newDatasetVersion]);
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Copy Error ${err}`,
      });
    }

    return { newDatasetId: newDataset.id, newDatasetVersionId: newDatasetVersion.id };
  });

