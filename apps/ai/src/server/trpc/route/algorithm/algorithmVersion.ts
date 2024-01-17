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

import { getUserHomedir, sftpExists } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import path, { basename, dirname, join } from "path";
import { Algorithm } from "src/server/entities/Algorithm";
import { AlgorithmVersion, SharedStatus } from "src/server/entities/AlgorithmVersion";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCopyFile } from "src/server/utils/checkFilePermission";
import { chmod } from "src/server/utils/chmod";
import { copyFile } from "src/server/utils/copyFile";
import { clusterNotFound } from "src/server/utils/errors";
import { getORM } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { paginationSchema } from "src/server/utils/pagination";
import { checkSharePermission, getUpdatedSharedPath, SHARED_TARGET,
  shareFileOrDir, unShareFileOrDir } from "src/server/utils/share";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { z } from "zod";

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
    isPublic:z.boolean().optional(),
  }))
  .output(z.object({ items: z.array(z.object({
    id:z.number(),
    versionName:z.string(),
    versionDescription:z.string().optional(),
    path:z.string(),
    privatePath: z.string(),
    sharedStatus:z.nativeEnum(SharedStatus),
    createTime:z.string().optional(),
  })), count: z.number() }))
  .query(async ({ input:{ algorithmId, page, pageSize, isPublic } }) => {
    const orm = await getORM();
    const [items, count] = await orm.em.findAndCount(AlgorithmVersion,
      {
        algorithm: algorithmId,
        ...isPublic ? { sharedStatus:SharedStatus.SHARED } : {},
      },
      {
        populate: ["algorithm"],
        ...page ?
          {
            offset: (page - 1) * (pageSize || 10),
            limit: pageSize || 10,
          } : {},
        orderBy: { createTime: "desc" },
      });

    return { items:items.map((x) => {
      return {
        id:x.id,
        versionName:x.versionName,
        versionDescription:x.versionDescription,
        sharedStatus:x.sharedStatus,
        createTime:x.createTime ? x.createTime.toISOString() : undefined,
        path:x.path,
        privatePath: x.privatePath,
      };
    }), count };
  });

export const createAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/algorithms/{algorithmId}/versions",
      tags: ["algorithmVersion"],
      summary: "Create a new algorithmVersion",
    },
  })
  .input(z.object({
    versionName: z.string(),
    path: z.string(),
    versionDescription: z.string().optional(),
    algorithmId: z.number(),
  }))
  .output(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx: { user } }) => {
    const { em } = await getORM();
    const algorithm = await em.findOne(Algorithm, { id: input.algorithmId });
    if (!algorithm) throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${input.algorithmId} not Found` });

    if (algorithm && algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "CONFLICT",
        message: `Algorithm id:${input.algorithmId} is belonged to the other user`,
      });

    const algorithmVersionExist = await em.findOne(AlgorithmVersion,
      { versionName: input.versionName, algorithm });
    if (algorithmVersionExist)
      throw new TRPCError({ code: "CONFLICT", message: `AlgorithmVersion name:${input.versionName} already exist` });

    // 检查目录是否存在
    const host = getClusterLoginNode(algorithm.clusterId);

    if (!host) { throw clusterNotFound(algorithm.clusterId); }

    await sshConnect(host, user.identityId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      if (!(await sftpExists(sftp, input.path))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${input.path} does not exists` });
      }
    });

    const algorithmVersion = new AlgorithmVersion({ ...input, privatePath: input.path, algorithm: algorithm });
    await em.persistAndFlush(algorithmVersion);
    return { id: algorithmVersion.id };
  });

export const updateAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/algorithmVersions/update/{versionId}",
      tags: ["algorithmVersion"],
      summary: "update a algorithmVersion",
    },
  })
  .input(z.object({
    algorithmId: z.number(),
    versionId: z.number(),
    versionName: z.string(),
    versionDescription: z.string().optional(),
  }))
  .output(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx: { user } }) => {
    const orm = await getORM();

    const algorithm = await orm.em.findOne(Algorithm, { id: input.algorithmId });
    if (!algorithm) throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${input.algorithmId} not found` });

    if (algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Algorithm ${input.algorithmId} not accessible` });

    const algorithmVersion = await orm.em.findOne(AlgorithmVersion, { id: input.versionId });
    if (!algorithmVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${input.versionId} not found` });

    const algorithmVersionExist = await orm.em.findOne(AlgorithmVersion, { versionName: input.versionName });
    if (algorithmVersionExist && algorithmVersionExist !== algorithmVersion) {
      throw new TRPCError({ code: "CONFLICT", message: `AlgorithmVersion name:${input.versionName} already exist` });
    }

    if (algorithmVersion.sharedStatus === SharedStatus.SHARING ||
      algorithmVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unfinished processing of algorithmVersion ${input.versionId} exists`,
      });
    }

    const needUpdateSharedPath = algorithmVersion.sharedStatus === SharedStatus.SHARED
    && input.versionName !== algorithmVersion.versionName;

    // 更新已分享目录下的版本路径名称
    if (needUpdateSharedPath) {
      // 获取更新后的已分享版本路径
      const newVersionSharedPath = await getUpdatedSharedPath({
        clusterId: algorithm.clusterId,
        newName: input.versionName,
        oldPath: dirname(algorithmVersion.path),
      });

      const baseFolderName = basename(algorithmVersion.path);

      algorithmVersion.path = join(newVersionSharedPath, baseFolderName);
    }

    algorithmVersion.versionName = input.versionName;
    algorithmVersion.versionDescription = input.versionDescription;

    await orm.em.flush();
    return { id: algorithmVersion.id };
  });

export const deleteAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/algorithmVersions/delete/{id}",
      tags: ["algorithmVersion"],
      summary: "delete a new algorithmVersion",
    },
  })
  .input(z.object({ id: z.number(), algorithmId:z.number() }))
  .output(z.void())
  .mutation(async ({ input:{ id, algorithmId }, ctx: { user } }) => {
    const orm = await getORM();
    const algorithmVersion = await orm.em.findOne(AlgorithmVersion, { id });
    if (!algorithmVersion) throw new Error(`AlgorithmVersion id:${id} not found`);

    const algorithm = await orm.em.findOne(Algorithm, { id: algorithmId },
      { populate: ["versions.sharedStatus"]});
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} is not found` });

    if (algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Algorithm id:${algorithmId} is not accessible` });

    // 正在分享中或取消分享中的版本，不可删除
    if (algorithmVersion.sharedStatus === SharedStatus.SHARING
      || algorithmVersion.sharedStatus === SharedStatus.UNSHARING) {
      throw new TRPCError(
        { code: "PRECONDITION_FAILED", message: `AlgorithmVersion (id:${id}) is currently being shared or unshared` });
    }

    // 如果是已分享的数据集版本，则删除分享
    if (algorithmVersion.sharedStatus === SharedStatus.SHARED) {

      try {
        const host = getClusterLoginNode(algorithm.clusterId);
        if (!host) { throw clusterNotFound(algorithm.clusterId); }

        await sshConnect(host, user.identityId, logger, async (ssh) => {
          await checkSharePermission({
            ssh,
            logger,
            sourcePath: algorithmVersion.privatePath,
            userId: user.identityId,
          });
        });

        const pathToUnshare
        = algorithm.versions.filter((v) => (v.id !== id && v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
          // 除了此版本以外仍有其他已分享的版本则取消分享当前版本
          dirname(algorithmVersion.path)
          // 除了此版本以外没有其他已分享的版本则取消分享整个算法
          : dirname(dirname(algorithmVersion.path));
        await unShareFileOrDir({
          host,
          sharedPath: pathToUnshare,
        });
      } catch (e) {
        logger.error(`ssh failure occurred when unshare algorithmVersion ${id} of algorithm ${algorithmId}`, e);
      }


      algorithm.isShared = algorithm.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 1
        ? true : false;
      await orm.em.flush();
    }

    orm.em.remove(algorithmVersion);
    await orm.em.flush();
    return;
  });

export const shareAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/algorithms/{algorithmId}/versions/{algorithmVersionId}/share",
      tags: ["algorithmVersion"],
      summary: "share a algorithmVersion",
    },
  })
  .input(z.object({
    algorithmId: z.number(),
    algorithmVersionId: z.number(),
    sourceFilePath: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input:{ algorithmId, algorithmVersionId, sourceFilePath }, ctx: { user } }) => {
    const orm = await getORM();
    const algorithmVersion = await orm.em.findOne(AlgorithmVersion, { id: algorithmVersionId });
    if (!algorithmVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmId} not found` });

    if (algorithmVersion.sharedStatus === SharedStatus.SHARED)
      throw new TRPCError({ code: "CONFLICT", message: `AlgorithmVersion id:${algorithmId} is already shared` });

    const algorithm = await orm.em.findOne(Algorithm, { id: algorithmId });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

    if (algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Algorithm id:${algorithmId}  not accessible` });

    const host = getClusterLoginNode(algorithm.clusterId);
    if (!host) { throw clusterNotFound(algorithm.clusterId); }

    const homeTopDir = await sshConnect(host, user.identityId, logger, async (ssh) => {
      // 确认是否具有分享权限
      await checkSharePermission({ ssh, logger, sourcePath: sourceFilePath, userId: user.identityId });
      // 获取分享路径的上级路径
      const userHomeDir = await getUserHomedir(ssh, user.identityId, logger);
      return dirname(dirname(userHomeDir));
    });

    algorithmVersion.sharedStatus = SharedStatus.SHARING;
    orm.em.persist([algorithmVersion]);
    await orm.em.flush();

    const successCallback = async (targetFullPath: string) => {
      const versionPath = join(targetFullPath, path.basename(sourceFilePath));
      algorithmVersion.sharedStatus = SharedStatus.SHARED;
      algorithmVersion.path = versionPath;
      if (!algorithm.isShared) { algorithm.isShared = true; };
      await orm.em.persistAndFlush([algorithmVersion, algorithm]);
    };

    const failureCallback = async () => {
      algorithmVersion.sharedStatus = SharedStatus.UNSHARED;
      await orm.em.persistAndFlush([algorithmVersion]);
    };

    shareFileOrDir({
      clusterId: algorithm.clusterId,
      sourceFilePath,
      userId: user.identityId,
      sharedTarget: SHARED_TARGET.ALGORITHM,
      targetName: algorithm.name,
      targetSubName: algorithmVersion.versionName,
      homeTopDir,
    }, successCallback, failureCallback);

    return;
  });

export const unShareAlgorithmVersion = procedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/algorithm/{algorithmId}/versions/{algorithmVersionId}/share",
      tags: ["algorithmVersion"],
      summary: "unshare a algorithmVersion",
    },
  })
  .input(z.object({
    algorithmVersionId: z.number(),
    algorithmId: z.number(),
  }))
  .output(z.void())
  .mutation(async ({ input:{ algorithmVersionId, algorithmId }, ctx: { user } }) => {
    const orm = await getORM();
    const algorithmVersion = await orm.em.findOne(AlgorithmVersion, { id: algorithmVersionId });
    if (!algorithmVersion)
      throw new TRPCError({ code: "NOT_FOUND", message: `AlgorithmVersion id:${algorithmVersionId} not found` });

    if (algorithmVersion.sharedStatus === SharedStatus.UNSHARED)
      throw new TRPCError({
        code: "CONFLICT",
        message: `AlgorithmVersion id:${algorithmVersionId} is already unShared`,
      });

    const algorithm = await orm.em.findOne(Algorithm, { id: algorithmId }, {
      populate: ["versions.sharedStatus"],
    });
    if (!algorithm)
      throw new TRPCError({ code: "NOT_FOUND", message: `Algorithm id:${algorithmId} not found` });

    if (algorithm.owner !== user.identityId)
      throw new TRPCError({ code: "FORBIDDEN", message: `Algorithm id:${algorithmId} not accessible` });

    const host = getClusterLoginNode(algorithm.clusterId);
    if (!host) { throw clusterNotFound(algorithm.clusterId); }

    await sshConnect(host, user.identityId, logger, async (ssh) => {
      await checkSharePermission({
        ssh,
        logger,
        sourcePath: algorithmVersion.privatePath,
        userId: user.identityId,
      });
    });

    algorithmVersion.sharedStatus = SharedStatus.UNSHARING;
    orm.em.persist([algorithmVersion]);
    await orm.em.flush();

    const successCallback = async () => {
      algorithmVersion.sharedStatus = SharedStatus.UNSHARED;
      algorithmVersion.path = algorithmVersion.privatePath;
      algorithm.isShared = algorithm.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0
        ? true : false;
      await orm.em.persistAndFlush([algorithmVersion, algorithm]);
    };

    const failureCallback = async () => {
      algorithmVersion.sharedStatus = SharedStatus.SHARED;
      await orm.em.persistAndFlush([algorithmVersion]);
    };

    unShareFileOrDir({
      host,
      sharedPath: algorithm.versions.filter((v) => (v.sharedStatus === SharedStatus.SHARED)).length > 0 ?
        // 如果还有其他的已分享版本则只取消此版本的分享
        dirname(algorithmVersion.path)
        // 如果没有其他的已分享版本则取消整个算法的分享
        : dirname(dirname(algorithmVersion.path)),
    }, successCallback, failureCallback);

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
  .output(z.object({ success: z.boolean() }))
  .mutation(async ({ input, ctx: { user } }) => {
    const orm = await getORM();

    // 1. 检查算法版本是否为公开版本
    const algorithmVersion = await orm.em.findOne(AlgorithmVersion,
      { id: input.algorithmVersionId, sharedStatus: SharedStatus.SHARED },
      { populate: ["algorithm"]});

    if (!algorithmVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Algorithm Version ${input.algorithmVersionId} does not exist or is not public`,
      });
    }
    // 2. 检查该用户是否已有同名算法
    const algorithm = await orm.em.findOne(Algorithm, { name: input.algorithmName, owner: user.identityId });
    if (algorithm) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `An algorithm with the same name as ${input.algorithmName} already exists`,
      });
    }

    // 3. 检查用户是否可以将源算法拷贝至目标目录
    const host = getClusterLoginNode(algorithmVersion.algorithm.$.clusterId);

    if (!host) { throw clusterNotFound(algorithmVersion.algorithm.$.clusterId); }

    await checkCopyFile({ host, userIdentityId: user.identityId,
      toPath: input.path, fileName: path.basename(algorithmVersion.path) });

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

    try {
      await copyFile({ host, userIdentityId: user.identityId,
        fromPath: algorithmVersion.path, toPath: input.path });
      // 递归修改文件权限和拥有者
      await chmod({ host, userIdentityId: "root", permission: "750", path: input.path });
      await orm.em.persistAndFlush([newAlgorithm, newAlgorithmVersion]);
    } catch (err) {
      console.log(err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Copy Error",
      });
    }

    return { success: true };
  });
