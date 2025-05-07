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
import { callLog } from "src/server/setup/operationLog";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { logger } from "src/server/utils/logger";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../utils/clusters";
import { withFileDriver } from "../fileDriver/fileDriver";
import { FileMetaSchema, ListDirectorySchema } from "../model/file";



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
    .mutation(async ({ input: { op, clusterId, fromPath, toPath }, ctx: { user, req } }) => {

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
    .use(async ({ input:{ clusterId,path }, ctx, next }) => {
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
    .use(async ({ input:{ clusterId,path }, ctx, next }) => {
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

  decompression: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/file/unzip",
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

});
