import { ConnectError } from "@connectrpc/connect";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { libGetUserQuotaUsage } from "@scow/lib-web/build/server/storage";
import { TRPCError } from "@trpc/server";
import path, { join } from "path";
import { commonConfig } from "src/server/config/common";
import { config as envConfig } from "src/server/config/env";
import { callLog } from "src/server/setup/operationLog";
import { router } from "src/server/trpc/def";
import { withFileDriver } from "src/server/trpc/Driver/fileDriver/fileDriver";
import { FileMetaSchema, InitMultipartUploadResponseSchema, ListDirectorySchema } from "src/server/trpc/model/file";
import { authProcedure } from "src/server/trpc/procedure/base";
import { PlatformRole } from "src/server/trpc/route/auth";
import { clusters } from "src/server/trpc/route/config";
import { getScowdClient, mapConnectErrorToTRPCError } from "src/server/trpc/scowd/scowd";
import { getCurrentClusters } from "src/server/utils/clusters";
import { checkClusterAvailable, shouldPathsSkipPermissionCheck } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

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
        { clusterId, user: user.identityId },
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
    .input(
      z.object({
        clusterId: z.string(),
        target: z.enum(["FILE", "DIR", "SYMLINK"]),
        path: z.string(),
      }),
    )
    .output(z.void())
    .use(async ({ input: { target, clusterId, path }, ctx, next }) => {
      const res = await next({ ctx });
      const { user, req } = ctx;

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypePayload: {
          clusterId,
          path,
        },
      };

      if (target === "FILE") {
        if (res.ok) {
          await callLog({ ...logInfo, operationTypeName: OperationType.deleteFile }, OperationResult.SUCCESS);
        } else {
          await callLog({ ...logInfo, operationTypeName: OperationType.deleteFile }, OperationResult.FAIL);
        }
      } else {
        if (res.ok) {
          await callLog({ ...logInfo, operationTypeName: OperationType.deleteDirectory }, OperationResult.SUCCESS);
        } else {
          await callLog({ ...logInfo, operationTypeName: OperationType.deleteDirectory }, OperationResult.FAIL);
        }
      }
      return res;
    })
    .mutation(async ({ input: { target, clusterId, path }, ctx: { user } }) => {
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => {
          if (target === "FILE") {
            await driver.deleteFile(path, noCheckPermission);
          } else {
            await driver.deleteDir(path, noCheckPermission);
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
    .input(
      z.object({
        clusterId: z.string(),
        op: z.enum(["copy", "move"]),
        fromPath: z.string(),
        toPath: z.string(),
      }),
    )
    .output(z.void())
    .use(async ({ input: { clusterId, op, fromPath, toPath }, ctx, next }) => {
      const res = await next({ ctx });
      const { user, req } = ctx;

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypePayload: {
          clusterId,
          fromPath,
          toPath,
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

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [fromPath, toPath], isPlatformAdmin);

      if (op === "copy") {
        await withFileDriver(
          { clusterId, user: user.identityId },
          async (driver) => {
            await driver.copy(fromPath, toPath, noCheckPermission);
          },
          logger,
        );
      } else {
        await withFileDriver(
          { clusterId, user: user.identityId },
          async (driver) => {
            await driver.move(fromPath, toPath, noCheckPermission);
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
    .use(async ({ input: { path, clusterId }, ctx, next }) => {
      const res = await next({ ctx });
      const { user, req } = ctx;

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createDirectory,
        operationTypePayload: {
          clusterId,
          path,
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

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => {
          await driver.makeDirectory(path, noCheckPermission);
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
    .use(async ({ input: { path, clusterId }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createFile,
        operationTypePayload: {
          clusterId,
          path,
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

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => {
          await driver.createFile(path, noCheckPermission);
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

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => await driver.readDirectory(path, noCheckPermission),
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
    .input(
      z.object({
        clusterId: z.string(),
        path: z.string(),
        isPlatformOwned: z.optional(z.boolean()),
      }),
    )
    .output(
      z.object({
        exists: z.boolean(),
        existsForUsedPath: z.boolean().optional(), // 是否存在于之前的公共数据资产配置路径
      }),
    )
    .mutation(async ({ input: { clusterId, path, isPlatformOwned }, ctx: { user } }) => {
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      // 如果是平台管理员访问公共目录，则不会抛出权限错误，而是返回false
      const safeExists = async (noCheckPermission: boolean) => {
        try {
          return await withFileDriver(
            { clusterId, user: user.identityId },
            async (driver) => await driver.exists(path, noCheckPermission),
            logger,
          );
        } catch (err) {
          if (isPlatformAdmin) {
            return false;
          }
          throw err;
        }
      };

      const exists = await safeExists(noCheckPermission);

      if (isPlatformOwned && isPlatformAdmin) {
        const existsForUsedPath = await safeExists(true);

        return { exists, existsForUsedPath };
      }

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

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => await driver.getFileMetadata(path, noCheckPermission),
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

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => {
          await driver.download(path, download, res, noCheckPermission);
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
    .input(
      z.object({
        clusterId: z.string(),
        filePath: z.string(),
        decompressionPath: z.string(),
        usePublicPath: z.optional(z.boolean()),
      }),
    )
    .output(z.void())
    .mutation(async ({ input: { clusterId, filePath, decompressionPath, usePublicPath }, ctx: { user } }) => {
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(
        clusterId,
        [filePath, decompressionPath],
        isPlatformAdmin,
      );

      if (usePublicPath && !noCheckPermission) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${decompressionPath} is outside the required PublicPath boundary`,
        });
      }

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => {
          await driver.decompressFile(filePath, decompressionPath, noCheckPermission);
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

      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [...filePaths, archivePath], isPlatformAdmin);

      return await withFileDriver(
        { clusterId, user: user.identityId },
        async (driver) => {
          await driver.compressFiles(filePaths, archivePath, noCheckPermission);
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
    .input(
      z.object({
        clusterId: z.string(),
        paths: z.string().transform((val) => (val === "" ? [] : val.split(","))),
      }),
    )
    .output(
      z.array(
        z.object({
          path: z.string(),
          quotaBytes: z.number(),
          usedStorageBytes: z.number(),
        }),
      ),
    )
    .query(async ({ input: { clusterId, paths }, ctx: { user } }) => {
      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const { quotaUsage } = await libGetUserQuotaUsage(
        user.identityId,
        clusterId,
        paths,
        envConfig.MIS_SERVER_URL,
        commonConfig.scowApi?.auth?.token,
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
    .input(
      z.object({
        clusterId: z.string(),
        path: z.string(),
        name: z.string(),
        fileSizeByte: z.number(),
        modificationTime: z.number(),
      }),
    )
    .output(InitMultipartUploadResponseSchema)
    .use(async ({ input: { path, clusterId, name }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.uploadFile,
        operationTypePayload: {
          clusterId,
          path: join(path, name),
        },
      };

      if (!res.ok) {
        await callLog(logInfo, OperationResult.FAIL);
      }

      return res;
    })
    .mutation(async ({ input: { clusterId, path, name, fileSizeByte, modificationTime }, ctx: { user } }) => {
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
      if (!host) {
        throw clusterNotFound(clusterId);
      }

      if (!cluster.scowd?.enabled) {
        throw new TRPCError({ code: "NOT_FOUND", message: "scowd client is not found" });
      }

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      try {
        const client = getScowdClient(clusterId, userId);
        const initData = await client.file.initMultipartUpload({
          userId: user.identityId,
          path,
          name,
          fileSizeByte: BigInt(fileSizeByte),
          modificationTime: BigInt(modificationTime),
          noCheckPermission,
        });

        return {
          chunkSizeByte: Number(initData.chunkSizeByte),
          fileSizeByte: Number(initData.fileSizeByte),
          modificationTime: Number(initData.modificationTime),
          uploadedIndices: initData.uploadedIndices.map((i) => Number(i)),
        };
      } catch (err) {
        subLogger.error({ error: err }, "Merge file chunks failed");
        if (err instanceof ConnectError) {
          throw mapConnectErrorToTRPCError(err);
        }
        throw err;
      }
    }),

  completeMultipartUpload: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/completeMultipartUpload",
        tags: ["file"],
        summary: "完成分片上传",
      },
    })
    .input(
      z.object({
        clusterId: z.string(),
        path: z.string(),
        name: z.string(),
      }),
    )
    .output(z.object({}))
    .use(async ({ input: { path, clusterId, name }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.uploadFile,
        operationTypePayload: {
          clusterId,
          path: join(path, name),
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
    .mutation(async ({ input: { clusterId, path, name }, ctx: { user } }) => {
      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const subLogger = logger.child({ user, clusterId, path, name });
      subLogger.info("Complete multipart upload started");

      const cluster = clusters[clusterId];
      if (!cluster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
      }
      const host = getClusterLoginNode(clusterId);
      if (!host) {
        throw clusterNotFound(clusterId);
      }

      if (!cluster.scowd?.enabled) {
        throw new TRPCError({ code: "NOT_FOUND", message: "scowd client is not found" });
      }

      // 如果是平台管理员访问集群的公共目录时，则不需要检查权限
      const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
      const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);

      try {
        const client = getScowdClient(clusterId);
        await client.file.completeMultipartUpload({
          userId: user.identityId,
          path,
          name,
          noCheckPermission,
        });

        subLogger.info("Complete multipart upload completed successfully");
        return {};
      } catch (err) {
        subLogger.error({ error: err }, "Complete multipart upload failed");
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
    .input(
      z.object({
        clusterId: z.string(),
        path: z.string(),
        name: z.string(),
        sizeByte: z.number(),
      }),
    )
    .output(z.object({}))
    .use(async ({ input: { path, clusterId, name }, ctx, next }) => {
      const res = await next({ ctx });

      const { user, req } = ctx;
      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.uploadFile,
        operationTypePayload: {
          clusterId,
          path: join(path, name),
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
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "This interface is deprecated.",
      });
    }),
});
