import { ConnectError } from "@connectrpc/connect";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { libGetUserQuotaUsage } from "@scow/lib-web/build/server/storage";
import { TRPCError } from "@trpc/server";
import path, { join } from "path";
import { commonConfig } from "src/server/config/common";
import { config as envConfig } from "src/server/config/env";
import { callLog } from "src/server/setup/operationLog";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../utils/clusters";
import { withFileDriver } from "../Driver/fileDriver/fileDriver";
import { FileMetaSchema, InitMultipartUploadResponseSchema,
  ListDirectoryOutput, ListDirectorySchema } from "../model/file";
import { getScowdClient, mapConnectErrorToTRPCError } from "../scowd/scowd";
import { clusters } from "./config";



// 这些文件操作的API如果按照restful的设计风格，应该把path设置在url中，而不是body中
// 但是HTTP的URL不区分大小写，但是linux的路径区分
// 所以还是直接放在body中吧，也不用按照restful的设计风格了
export const file = router({
  getHomeDir: authProcedure
    .meta({
      openapi: {
        // GET /file/homeDir
        method: "GET",
        path: "/file/homeDir",
        tags: ["file"],
        summary: "获取用户家目录路径",
      },
    })
    .input(z.object({ clusterId: z.string() }))
    .output(z.object({ path: z.string() }))
    .query(async ({ input: { clusterId }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          const homeDir = await driver.getHomeDirectory();
          return { path: homeDir };
        },
        logger,
      );
    }),


  deleteItem: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/delete",
        tags: ["file"],
        summary: "删除指定的文件或目录",
      },
    })
    .input(z.object({ clusterId: z.string(), target: z.enum(["FILE", "DIR"]), path: z.string() }))
    .output(z.void())
    .use(async ({ input:{ target, clusterId, path }, ctx, next }) => {
      const res = await next({ ctx });
      const { user, req } = ctx;

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypePayload:{
          clusterId, path,
        },
      };

      if (target === "FILE") {
        if (res.ok) {
          await callLog({ ...logInfo, operationTypeName:OperationType.deleteFile }, OperationResult.SUCCESS);
        } else {
          await callLog({ ...logInfo, operationTypeName: OperationType.deleteFile }, OperationResult.FAIL);
        }
      } else {
        if (res.ok) {
          await callLog({ ...logInfo, operationTypeName:OperationType.deleteDirectory }, OperationResult.SUCCESS);

        } else {
          await callLog({ ...logInfo, operationTypeName:OperationType.deleteDirectory }, OperationResult.FAIL);

        }
      }
      return res;
    })
    .mutation(async ({ input: { target, clusterId, path }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          if (target === "FILE") {
            await driver.deleteFile(path);
          } else {
            await driver.deleteDir(path);
          }
        },
        logger,
      );
    }),
  copyOrMove: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/copyOrMove",
        tags: ["file"],
        summary: "复制或移动文件",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      op: z.enum(["copy", "move"]),
      fromPath: z.string(),
      toPath: z.string(),
    }))
    .output(z.void())
    .use(async ({ input:{ clusterId,op,fromPath,toPath }, ctx, next }) => {
      const res = await next({ ctx });
      const { user, req } = ctx;

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypePayload:{
          clusterId, fromPath, toPath,
        },
      };

      if (op === "copy") {
        if (res.ok) {
          await callLog({ ...logInfo, operationTypeName: OperationType.copyFileItem }, OperationResult.SUCCESS);
        } else {
          await callLog({ ...logInfo, operationTypeName: OperationType.copyFileItem }, OperationResult.FAIL);
        }
      } else {
        if (res.ok) {
          await callLog({ ...logInfo, operationTypeName: OperationType.moveFileItem }, OperationResult.SUCCESS);
        } else {
          await callLog({ ...logInfo, operationTypeName: OperationType.moveFileItem }, OperationResult.FAIL);
        }
      }
      return res;
    })
    .mutation(async ({ input: { op, clusterId, fromPath, toPath }, ctx: { user } }) => {

      // 校验targetPath是否与fromPath自身相同或是fromPath的子目录
      // 因为同名文件与文件夹不可能共存，所以此处不用考虑类型为文件的特殊情况
      const normalizedFromPath = path.normalize(fromPath);
      const normalizedToPath = path.normalize(toPath);
      if (toPath === fromPath || normalizedToPath.startsWith(normalizedFromPath + path.sep)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can not copy a directory ${fromPath} to itself or its sub directory ${toPath}`,
        });
      }

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      if (op === "copy") {
        await withFileDriver(
          { clusterId, user:user.identityId },
          async (driver) => {
            await driver.copy(fromPath, toPath);
          },
          logger,
        );
      } else {
        await withFileDriver(
          { clusterId, user:user.identityId },
          async (driver) => {
            await driver.move(fromPath, toPath);
          },
          logger,
        );
      }
    }),

  mkdir: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/mkdir",
        tags: ["file"],
        summary: "创建新目录",
      },
    })
    .input(z.object({ clusterId: z.string(), path: z.string() }))
    .output(z.void())
    .use(async ({ input:{ path,clusterId }, ctx, next }) => {
      const res = await next({ ctx });
      const { user, req } = ctx;

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createDirectory,
        operationTypePayload:{
          clusterId, path,
        },
      };

      if (res.ok) {
        await callLog(logInfo, OperationResult.SUCCESS);
      }

      if (!res.ok) {
        await callLog(logInfo, OperationResult.FAIL);
      }

      return res;
    })
    .mutation(async ({ input: { clusterId, path }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          await driver.makeDirectory(path);
        },
        logger,
      );
    }),

  createFile: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/createFile",
        tags: ["file"],
        summary: "创建新文件",
      },
    })
    .input(z.object({ clusterId: z.string(), path: z.string() }))
    .output(z.void())
    .use(async ({ input:{ path,clusterId }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createFile,
        operationTypePayload:{
          clusterId, path,
        },
      };

      if (res.ok) {
        await callLog(logInfo, OperationResult.SUCCESS);
      }

      if (!res.ok) {
        await callLog(logInfo, OperationResult.FAIL);
      }

      return res;
    })
    .mutation(async ({ input: { clusterId, path }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          await driver.createFile(path);
        },
        logger,
      );
    }),

  listDirectory: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/file/listDirectory",
        tags: ["file"],
        summary: "列出目录内容",
      },
    })
    .input(z.object({ clusterId: z.string(), path: z.string() }))
    .output(z.array(ListDirectorySchema))
    .query(async ({ input: { clusterId, path }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => await driver.readDirectory(path),
        logger,
      );
    }),

  checkFileExist: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/file/checkExist",
        tags: ["file"],
        summary: "检查文件是否存在",
      },
    })
    .input(z.object({ clusterId: z.string(), path: z.string() }))
    .output(z.object({
      exists: z.boolean(),
    }))
    .mutation(async ({ input: { clusterId, path }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const exists = await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => await driver.exists(path),
        logger,
      );

      return { exists };
    }),

  getFileType: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/file/fileType",
        tags: ["file"],
        summary: "获取文件类型",
      },
    })
    .input(z.object({ clusterId: z.string(), path: z.string() }))
    .output(FileMetaSchema)
    .mutation(async ({ input: { clusterId, path }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => await driver.getFileMetadata(path),
        logger,
      );
    }),

  download: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/file/download",
        tags: ["file"],
        summary: "文件下载",
      },
    })
    .input(z.object({ clusterId: z.string(), path: z.string(), download: z.string() }))
    .output(z.void())
    .query(async ({ input: { clusterId, path, download }, ctx: { user, res } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const subLogger = logger.child({ user, path, clusterId });
      subLogger.info("Download file started");

      await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          await driver.download(path, download, res);
        },
        logger,
      );

    }),

  decompressFile: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/decompressFile",
        tags: ["file"],
        summary: "解压文件",
      },
    })
    .input(z.object({ clusterId: z.string(), filePath: z.string(), decompressionPath: z.string() }))
    .output(z.void())
    .mutation(async ({ input: { clusterId, filePath, decompressionPath }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          await driver.decompressFile(filePath, decompressionPath);
        },
        logger,
      );
    }),

  compressFiles: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/compressFiles",
        tags: ["file"],
        summary: "压缩文件",
      },
    })
    .input(z.object({ clusterId: z.string(), filePaths: z.array(z.string()), archivePath: z.string() }))
    .output(z.void())
    .mutation(async ({ input: { clusterId, filePaths, archivePath }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await withFileDriver(
        { clusterId, user:user.identityId },
        async (driver) => {
          await driver.compressFiles(filePaths, archivePath);
        },
        logger,
      );
    }),


  getUserStorageInfo: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/file/storageInfo",
        tags: ["file"],
        summary: "获取用户存储配额",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      paths: z.string()
        .transform((val) => val === "" ? [] : val.split(",")),
    }))
    .output(z.array(z.object({
      path:z.string(),
      quotaBytes:z.number(),
      usedStorageBytes:z.number(),
    })))
    .query(async ({ input: { clusterId, paths }, ctx: { user } }) => {

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const { quotaUsage } = await libGetUserQuotaUsage(
        user.identityId, clusterId, paths, envConfig.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token,
      );

      return quotaUsage;
    }),

  initMultipartUpload: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/initMultipartUpload",
        tags: ["file"],
        summary: "初始化分片上传",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      path: z.string(),
      name: z.string(),
    }))
    .output(InitMultipartUploadResponseSchema)
    .use(async ({ input:{ path, clusterId, name }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.uploadFile,
        operationTypePayload:{
          clusterId, path: join(path, name),
        },
      };

      if (!res.ok) {
        await callLog(logInfo, OperationResult.FAIL);
      }

      return res;
    })
    .mutation(async ({ input: { clusterId, path, name }, ctx: { user } }) => {

      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const subLogger = logger.child({ user, clusterId, path, name });
      subLogger.info("Init multipart upload started");

      const cluster = clusters[clusterId];
      if (!cluster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
      }
      const host = getClusterLoginNode(clusterId);
      if (!host) { throw clusterNotFound(clusterId); }

      if (!cluster.scowd?.enabled) {
        throw new TRPCError({ code: "NOT_FOUND", message: "scowd client is not found" });
      }

      try {
        const client = getScowdClient(clusterId);
        const initData = await client.file.initMultipartUpload({
          userId: user.identityId,
          path,
          name,
        });

        return {
          ...initData,
          chunkSizeByte: Number(initData.chunkSizeByte),
          filesInfo: initData.filesInfo.map((info): ListDirectoryOutput => ({
            name: info.name,
            // TODO: 修改
            type: info.fileType === 0 ? "FILE" : "DIR",
            mtime: info.modTime,
            mode: info.mode,
            size: Number(info.sizeByte),
          })),
        };

      } catch (err) {
        subLogger.error({ error: err }, "Merge file chunks failed");
        if (err instanceof ConnectError) {
          throw mapConnectErrorToTRPCError(err);
        }
        throw err;
      }
    }),


  mergeFileChunks: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/mergeFileChunks",
        tags: ["file"],
        summary: "合并文件分片",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      path: z.string(),
      name: z.string(),
      sizeByte: z.number(),
    }))
    .output(z.object({}))
    .use(async ({ input:{ path, clusterId, name }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.uploadFile,
        operationTypePayload:{
          clusterId, path: join(path, name),
        },
      };

      if (res.ok) {
        await callLog(logInfo, OperationResult.SUCCESS);
      }

      if (!res.ok) {
        await callLog(logInfo, OperationResult.FAIL);
      }

      return res;
    })
    .mutation(async ({ input: { clusterId, path, name, sizeByte }, ctx: { user } }) => {

      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const subLogger = logger.child({ user, clusterId, path, name });
      subLogger.info("Merge file chunks started");

      const cluster = clusters[clusterId];
      if (!cluster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
      }
      const host = getClusterLoginNode(clusterId);
      if (!host) { throw clusterNotFound(clusterId); }

      if (!cluster.scowd?.enabled) {
        throw new TRPCError({ code: "NOT_FOUND", message: "scowd client is not found" });
      }

      try {
        const client = getScowdClient(clusterId);
        await client.file.mergeFileChunks({
          userId: user.identityId,
          path,
          name,
          sizeByte: BigInt(sizeByte),
        });

        subLogger.info("Merge file chunks completed successfully");
        return {};

      } catch (err) {
        subLogger.error({ error: err }, "Merge file chunks failed");
        if (err instanceof ConnectError) {
          throw mapConnectErrorToTRPCError(err);
        }
        throw err;
      }
    }),

});
