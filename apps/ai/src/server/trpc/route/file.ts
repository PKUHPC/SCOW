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
import {
  sftpExists, sftpMkdir, sftpReaddir,
  sftpRealPath, sftpRename, sftpStat, sftpUnlink, sftpWriteFile, sshRmrf,
} from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { contentType } from "mime-types";
import { basename } from "path";
import { FileInfo } from "src/models/File";
import { config } from "src/server/config/env";
import { callLog } from "src/server/setup/operationLog";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { copyFile } from "src/server/utils/copyFile";
import { clusterNotFound } from "src/server/utils/errors";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

export const FileType = z.union([z.literal("FILE"), z.literal("DIR")]);
export type FileType = z.infer<typeof FileType>;

export const ListDirectorySchema = z.object({
  type: FileType,
  name: z.string(),
  mtime: z.string(),
  size: z.number(),
  mode: z.number(),
});

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

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      return await sshConnect(host, user.identityId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const path = await sftpRealPath(sftp)(".");

        return { path };
      });
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
    .mutation(async ({ input: { target, clusterId, path }, ctx: { user, req } }) => {

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypePayload:{
          clusterId, path,
        },
      };

      if (target === "FILE") {
        try {
          await sshConnect(host, user.identityId, logger, async (ssh) => {

            const sftp = await ssh.requestSFTP();

            await sftpUnlink(sftp)(path);

            return;
          });

          await callLog({ ...logInfo, operationTypeName:OperationType.deleteFile }, OperationResult.SUCCESS);

          return;
        } catch (error) {
          await callLog({ ...logInfo, operationTypeName:OperationType.deleteFile }, OperationResult.FAIL);

          throw error;
        }

      } else {

        try {
          await sshConnect(host, user.identityId, logger, async (ssh) => {

            await sshRmrf(ssh, path);

            return;
          });

          await callLog({ ...logInfo, operationTypeName:OperationType.deleteDirectory }, OperationResult.SUCCESS);

          return;
        } catch (error) {
          await callLog({ ...logInfo, operationTypeName:OperationType.deleteDirectory }, OperationResult.FAIL);

          throw error;
        }

      }
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
    .mutation(async ({ input: { op, clusterId, fromPath, toPath }, ctx: { user, req } }) => {

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypePayload:{
          clusterId, fromPath, toPath,
        },
      };

      if (op === "copy") {
        try {
          await copyFile({ host, userIdentityId: user.identityId, fromPath, toPath });
          await callLog({ ...logInfo, operationTypeName: OperationType.copyFileItem }, OperationResult.SUCCESS);

        } catch (error) {
          await callLog({ ...logInfo, operationTypeName: OperationType.copyFileItem }, OperationResult.FAIL);
          throw error;

        }

        return;

      } else {
        try {
          await sshConnect(host, user.identityId, logger, async (ssh) => {
            const sftp = await ssh.requestSFTP();

            if (await sftpExists(sftp, toPath)) {
              throw new TRPCError({ code: "CONFLICT", message: `${toPath} already exists` });
            }

            const error = await sftpRename(sftp)(fromPath, toPath).catch((e) => e);
            if (error) {
              throw new TRPCError({ code: "CONFLICT", message: "Rename or move failed. " + error });
            }

            await callLog({ ...logInfo, operationTypeName: OperationType.moveFileItem }, OperationResult.SUCCESS);

            return;
          });

          return;
        } catch (error) {
          await callLog({ ...logInfo, operationTypeName: OperationType.moveFileItem }, OperationResult.FAIL);

          throw error;
        }
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
    .mutation(async ({ input: { clusterId, path }, ctx: { user, req } }) => {
      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createDirectory,
        operationTypePayload:{
          clusterId, path,
        },
      };

      try {
        await sshConnect(host, user.identityId, logger, async (ssh) => {

          const sftp = await ssh.requestSFTP();

          if (await sftpExists(sftp, path)) {
            throw new TRPCError({ code: "CONFLICT", message: `${path} already exists` });
          }

          await sftpMkdir(sftp)(path);

          return;
        });

        await callLog(logInfo, OperationResult.SUCCESS);

        return;
      } catch (error) {
        await callLog(logInfo, OperationResult.FAIL);

        throw error;
      }

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
    .mutation(async ({ input: { clusterId, path }, ctx: { user, req } }) => {
      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.createFile,
        operationTypePayload:{
          clusterId, path,
        },
      };
      try {
        await sshConnect(host, user.identityId, logger, async (ssh) => {

          const sftp = await ssh.requestSFTP();

          if (await sftpExists(sftp, path)) {
            throw new TRPCError({ code: "CONFLICT", message: `${path} already exists` });
          }

          await sftpWriteFile(sftp)(path, Buffer.alloc(0));

          return;
        });

        await callLog(logInfo, OperationResult.SUCCESS);

        return;
      } catch (error) {
        await callLog(logInfo, OperationResult.FAIL);

        throw error;
      }
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
      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      return await sshConnect(host, user.identityId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const stat = await sftpStat(sftp)(path).catch((e) => {
          logger.error(e, "stat %s as %s failed", path, user.identityId);
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${path} is not accessible` });
        });

        if (!stat || !stat.isDirectory()) {
          throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: `${path} is not directory or not exists` });
        }

        const files = await sftpReaddir(sftp)(path);
        const list: FileInfo[] = [];

        for (const file of files) {

          const isDir = file.longname.startsWith("d");

          list.push({
            type: isDir ? "DIR" : "FILE",
            name: file.filename,
            mtime: new Date(file.attrs.mtime * 1000).toISOString(),
            size: file.attrs.size,
            mode: file.attrs.mode,
          });
        }
        return list.map((x) => ({
          ...x,
          type: x.type === "DIR" ? "DIR" as const : "FILE" as const,
        }));
      });
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

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      return await sshConnect(host, user.identityId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();
        const exists = await sftpExists(sftp, path);
        return { exists };
      });
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
    .output(z.object({
      size: z.number(),
      type: z.string(),
    }))
    .mutation(async ({ input: { clusterId, path }, ctx: { user } }) => {

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      return await sshConnect(host, user.identityId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const stat = await sftpStat(sftp)(path).catch((e) => {
          logger.error(e, "stat %s as %s failed", path, user.identityId);
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
        });

        return { size: stat.size, type: stat.isDirectory() ? "dir" : "file" };
      });
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

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const subLogger = logger.child({ user, path, clusterId });
      subLogger.info("Download file started");

      await sshConnect(host, user.identityId, subLogger, async (ssh) => {

        const sftp = await ssh.requestSFTP();

        const stat = await sftpStat(sftp)(path).catch((e) => {
          logger.error(e, "stat %s as %s failed", path, user.identityId);
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
        });

        const readStream = sftp.createReadStream(path, { highWaterMark: config.DOWNLOAD_CHUNK_SIZE });

        const filename = basename(path).replace("\"", "\\\"");
        const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

        const contentType = download === "true" ? getContentType(filename, "application/octet-stream") :
          getContentType(filename, "text/plain; charset=utf-8");
        res.setHeader("Content-Type", contentType);

        res.setHeader("Content-Disposition", `${download === "true" ? "attachment" : "inline"}; ${dispositionParm}`);

        res.setHeader("Content-Length", String(stat.size));

        return new Promise<void>((resolve, reject) => {
          readStream.pipe(res, { end: true })
            .on("error", () => {
              reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Error when reading file" }));
            })
            .on("end", () => {
              resolve();
            });
        });

      });

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
      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const getDecompressionCommand = () => {
        if (filePath.endsWith(".tar")) {
          return `tar -xf ${filePath} -C ${decompressionPath}`;
        } else if (filePath.endsWith(".tar.gz") || filePath.endsWith(".tgz")) {
          return `tar -xzf ${filePath} -C ${decompressionPath}`;
        } else if (filePath.endsWith(".zip")) {
          // TODO: 解压文件中文乱码，暂时指定为 gbk 编码
          return `unzip -O gbk ${filePath} -d ${decompressionPath}`;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: `${filePath} is an unknown file type` });
        }
      };

      return await sshConnect(host, user!.identityId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const stat = await sftpStat(sftp)(filePath).catch((e) => {
          logger.error(e, "stat %s as %s failed", filePath, user.identityId);
          throw new TRPCError({ code: "FORBIDDEN", message: `${filePath} is not accessible` });
        });

        if (stat.isDirectory()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `${filePath} is a directory` });
        }

        const decompressionCommand = getDecompressionCommand();

        const result = await ssh.execCommand(decompressionCommand);
        if (result.code !== 0) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR",
            message: `Failed to execute decompression command: ${result.stderr}` });
        }
      });
    }),

});

const textFiles = ["application/x-sh"];

function getContentType(filename: string, defaultValue: string) {
  const type = contentType(basename(filename));

  if (!type) {
    return defaultValue;
  }

  if (textFiles.some((x) => type.startsWith(x))) {
    return "text/plain; charset=utf-8";
  }

  return type;
}
