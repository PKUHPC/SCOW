import { ScowdClient } from "@scow/lib-scowd/build/client";
import { FileType as scowdFileType } from "@scow/scowd-protos/build/storage/file_pb";
import { TRPCError } from "@trpc/server";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import path, { basename, dirname, join } from "path";
import { config } from "src/server/config/env";
import { FileMeta, ListDirectoryOutput } from "src/server/trpc/model/file";
import { getScowdClient, mapConnectErrorToTRPCError, wrap } from "src/server/trpc/scowd/scowd";
import { ErrorCode } from "src/server/utils/errorCode";
import { getPermissionsFromMode } from "src/server/utils/getPermissionsFromMode";
import { Logger } from "ts-log";

import { callback, FileDriver, SHARED_DIR, shareOkCallback, ShareParams } from "./fileDriver";
import { getContentType, readableStreamToNodeReadable } from "./sshFileDriver";

export class ScowdFileDriver implements FileDriver {
  private client: ScowdClient;

  constructor(
    private clusterId: string,
    private userId: string,
    private logger: Logger,
  ) {
    this.client = getScowdClient(this.clusterId, this.userId);
  }

  async deleteFile(path: string, noCheckPermission?: boolean): Promise<void> {
    await wrap(
      this.client.file.deleteFile({
        userId: this.userId,
        filePath: path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
  }

  async deleteDir(path: string, noCheckPermission?: boolean): Promise<void> {
    await wrap(
      this.client.file.deleteDirectory({
        userId: this.userId,
        dirPath: path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
  }

  async getHomeDirectory(): Promise<string> {
    const resp = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    return resp.path;
  }

  async copy(fromPath: string, toPath: string, noCheckPermission?: boolean): Promise<void> {
    await wrap(
      this.client.file.copy({
        userId: this.userId,
        fromPath,
        toPath,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
  }

  async move(fromPath: string, toPath: string, noCheckPermission?: boolean): Promise<void> {
    await wrap(
      this.client.file.move({
        userId: this.userId,
        fromPath,
        toPath,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
  }

  async makeDirectory(path: string, noCheckPermission?: boolean): Promise<void> {
    const { exists } = await wrap(
      this.client.file.exists({ userId: this.userId, path, noCheckPermission }),
      this.logger,
    );

    if (exists) {
      throw new TRPCError({ code: "CONFLICT", message: `${path} already exists` });
    }

    await wrap(
      this.client.file.makeDirectory({
        userId: this.userId,
        dirPath: path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
  }
  async createFile(path: string, noCheckPermission?: boolean): Promise<void> {
    const { exists } = await wrap(
      this.client.file.exists({ userId: this.userId, path, noCheckPermission }),
      this.logger,
    );

    if (exists) {
      throw new TRPCError({ code: "CONFLICT", message: `${path} already exists` });
    }

    await wrap(
      this.client.file.createFile({
        userId: this.userId,
        filePath: path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
  }

  async readDirectory(path: string, noCheckPermission?: boolean): Promise<ListDirectoryOutput[]> {
    const resp = await wrap(
      this.client.file.readDirectory({
        userId: this.userId,
        dirPath: path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );

    const results = resp.filesInfo.map((info) => {
      const type =
        info.fileType === scowdFileType.DIR ? "DIR" : info.fileType === scowdFileType.SYMLINK ? "SYMLINK" : "FILE";

      const linkTargetType =
        info.linkTargetType === undefined
          ? undefined
          : info.linkTargetType === scowdFileType.DIR
            ? "DIR"
            : info.linkTargetType === scowdFileType.SYMLINK
              ? "SYMLINK"
              : "FILE";

      return {
        name: info.name,
        type,
        mtime: info.modTime,
        mode: info.mode,
        size: Number(info.sizeByte),
        linkTargetPath: info.linkTargetPath,
        linkTargetType,
      } as ListDirectoryOutput;
    });

    return results;
  }

  async exists(path: string, noCheckPermission?: boolean): Promise<boolean> {
    const resp = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );

    return resp.exists;
  }

  async getFileMetadata(path: string, noCheckPermission?: boolean): Promise<FileMeta> {
    const resp = await wrap(
      this.client.file.getFileMetadata({
        userId: this.userId,
        filePath: path,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );

    const type = resp.isSymlink ? "SYMLINK" : resp.type === scowdFileType.DIR ? "DIR" : "FILE";

    return {
      size: Number(resp.sizeByte),
      type: type,
      isSymlink: resp.isSymlink,
      linkTargetPath: resp.linkTargetPath,
      linkTargetType:
        resp.linkTargetType === scowdFileType.DIR
          ? "DIR"
          : resp.linkTargetType === scowdFileType.SYMLINK
            ? "SYMLINK"
            : "FILE",
    };
  }

  async download(path: string, download: string, res: NextApiResponse<any>, noCheckPermission?: boolean) {
    let clientDisconnected = false;
    const abortController = new AbortController();

    const onResClose = () => {
      this.logger.info(`Client disconnected during download of ${path}`);
      clientDisconnected = true;
      abortController.abort();
    };

    const onResError = (err: Error) => {
      this.logger.error(`Error on response stream for ${path}: ${err.message}`);
      clientDisconnected = true;
      abortController.abort();
    };

    res.on("close", onResClose);
    res.on("error", onResError);

    try {
      const meta = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath: path,
          noCheckPermission: noCheckPermission ?? false,
        }),
        this.logger,
      );

      const filename = basename(path).replace(/"/g, '\\"');
      const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

      const contentType =
        download === "true"
          ? getContentType(filename, "application/octet-stream")
          : getContentType(filename, "text/plain; charset=utf-8");
      res.setHeader("Content-Type", contentType);

      res.setHeader("Content-Disposition", `${download === "true" ? "attachment" : "inline"}; ${dispositionParm}`);

      res.setHeader("Content-Length", String(meta.sizeByte));

      const readStream = this.client.file.download(
        {
          userId: this.userId,
          path,
          chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
          noCheckPermission: noCheckPermission ?? false,
        },
        {
          signal: abortController.signal,
        },
      );

      for await (const { chunk } of readStream) {
        if (clientDisconnected || res.destroyed) {
          this.logger.info(`Download of ${path} aborted due to client disconnection or response destruction.`);
          break;
        }

        // 如果写入返回 false，表示缓冲区已满，需要等待 `drain` 事件
        if (!res.write(chunk)) {
          if (clientDisconnected || res.destroyed) {
            this.logger.info(`Download of ${path} aborted while write buffer full.`);
            break;
          }
          try {
            await new Promise<void>((resolve, reject) => {
              const onDrain = () => {
                res.removeListener("close", onEarlyCloseOrError);
                res.removeListener("error", onEarlyCloseOrError);
                resolve();
              };
              const onEarlyCloseOrError = (err?: Error) => {
                res.removeListener("drain", onDrain);
                clientDisconnected = true;
                if (err) {
                  this.logger.error(`Error (${err.message}) occurred while waiting for drain for ${path}.`);
                  reject(err);
                } else {
                  this.logger.info(`Client closed connection while waiting for drain for ${path}.`);
                  resolve();
                }
              };
              res.once("drain", onDrain);
              res.once("close", onEarlyCloseOrError);
              res.once("error", onEarlyCloseOrError);
            });
          } catch (drainError) {
            this.logger.error("Error while waiting for drain during download:", drainError);
            break;
          }
        }
        if (clientDisconnected || res.destroyed) {
          this.logger.info(`Download of ${path} aborted post-write/drain.`);
          break;
        }
      }
    } catch (err) {
      throw mapConnectErrorToTRPCError(err);
    } finally {
      res.removeListener("close", onResClose);
      res.removeListener("error", onResError);
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }

  async upload(path: string, uploadedFile: File, chunkIdx?: number, noCheckPermission?: boolean) {
    try {
      const userId = this.userId;

      await this.client.file.upload(
        (async function* () {
          // 初始上传信息：文件路径和用户信息
          yield {
            message: {
              case: "info",
              value: {
                path,
                userId,
                chunkIdx: chunkIdx !== undefined ? BigInt(chunkIdx) : undefined,
                noCheckPermission: noCheckPermission ?? false,
              },
            },
          };

          // 将上传的文件流拆分为块，并逐个发送给 gRPC 服务器
          const readableStream = uploadedFile.stream();
          const nodeReadableStream = readableStreamToNodeReadable(readableStream);

          for await (const chunk of nodeReadableStream) {
            // 逐个块上传，确保每个 chunk 都以 'chunk' 形式上传
            yield { message: { case: "chunk", value: chunk } };
          }
        })(),
      );

      return NextResponse.json({ message: "File uploaded successfully" }, { status: 200 });
    } catch (err) {
      throw mapConnectErrorToTRPCError(err);
    }
  }

  async chmod(path: string, mode: string): Promise<void> {
    await wrap(
      this.client.file.changeMode({
        userId: this.userId,
        path,
        mode,
        recursive: true,
      }),
      this.logger,
    );
  }

  async decompressFile(filePath: string, decompressionPath: string, noCheckPermission?: boolean): Promise<void> {
    await wrap(
      this.client.file.decompressFile({
        userId: this.userId,
        filePath,
        decompressionPath,
        noCheckPermission,
      }),
      this.logger,
    );
  }

  async compressFiles(paths: string[], archivePath: string, noCheckPermission?: boolean): Promise<void> {
    await wrap(
      this.client.file.compressFiles({
        userId: this.userId,
        paths,
        archivePath,
        noCheckPermission,
      }),
      this.logger,
    );
  }

  // 以root身份删除取消分享的文件夹
  async unShareFileOrDir(sharedPath: string, successCallback?: callback, failureCallback?: callback): Promise<void> {
    await wrap(
      this.client.file.deleteDirectory({
        userId: this.userId,
        dirPath: sharedPath,
      }),
      this.logger,
    )
      .then(() => successCallback?.())
      .catch((err) => {
        this.logger.info("unShare file failed", err);
        failureCallback?.();
      });
  }

  // 以root身份分享的文件夹
  async shareFileOrDir(
    { sourceFilePath, sharedTarget, targetName, targetSubName, sharedTopDir }: ShareParams,
    successCallback?: shareOkCallback,
    failureCallback?: callback,
  ): Promise<void> {
    // 获取类别路径 如 nfs/home/.shared/{userId}/{target}
    const targetDirectory = path.join(sharedTopDir, SHARED_DIR, this.userId, sharedTarget);
    // nfs/home/.shared/{userId}/{target}/{targetName}
    const targetTopDir = path.join(targetDirectory, targetName);
    // nfs/home/.shared/{userId}/{target}/{targetName}/{versionName}
    const targetFullDir = path.join(targetDirectory, targetName, targetSubName);

    try {
      const targetDirectoryExists = await wrap(
        this.client.file.exists({
          userId: this.userId,
          path: targetDirectory,
        }),
        this.logger,
      );

      // 判断共享目录是否存在
      if (!targetDirectoryExists.exists) {
        await wrap(
          this.client.file.makeDirectory({
            userId: this.userId,
            dirPath: targetDirectory,
          }),
          this.logger,
        );

        await wrap(
          this.client.file.changeMode({
            userId: this.userId,
            path: targetDirectory,
            mode: "555",
            recursive: true,
          }),
          this.logger,
        );
      }

      const targetFullDirExists = await wrap(
        this.client.file.exists({
          userId: this.userId,
          path: targetFullDir,
        }),
        this.logger,
      );

      // 判断目标路径是否存在，如果不存在则创建
      if (!targetFullDirExists.exists) {
        await wrap(
          this.client.file.makeDirectory({
            userId: this.userId,
            dirPath: targetFullDir,
          }),
          this.logger,
        );
      }

      // 复制并从顶层目录递归修改文件夹权限
      await wrap(
        this.client.file.copy({
          userId: this.userId,
          // sourceFilePath: /nfs/home/demo_admin2/1111
          // targetFullDir /nfs/.shared/demo_admin2/dataset/oyx0529/v1
          // 需要再targetFullDir 需要拼上sourceFilePath 的末尾
          fromPath: sourceFilePath,
          toPath: path.join(targetFullDir, path.basename(sourceFilePath)),
        }),
        this.logger,
      );

      await wrap(
        this.client.file.changeMode({
          userId: this.userId,
          path: targetTopDir,
          mode: "555",
          recursive: true,
        }),
        this.logger,
      );
      successCallback?.(targetFullDir);
    } catch (e) {
      failureCallback?.();
      this.logger.error("Failed to share %s to %s with error %s", sourceFilePath, targetFullDir, e);
    }
  }

  // 以root身份更新分享的路径
  async getUpdatedSharedPath(newName: string, oldPath: string): Promise<string> {
    const oldPathExistsRes = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: oldPath,
      }),
      this.logger,
    );
    if (!oldPathExistsRes.exists) {
      throw new TRPCError({ code: "NOT_FOUND", message: `${oldPath} is not found` });
    }

    const dir = dirname(oldPath);
    const newPath = join(dir, newName);

    await wrap(
      this.client.file.move({
        userId: this.userId,
        fromPath: oldPath,
        toPath: newPath,
      }),
      this.logger,
    );

    return newPath;
  }

  async checkCopyFilePath(toPath: string, fileName: string): Promise<void> {
    const toPathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: toPath,
      }),
      this.logger,
    );
    // 判断目标文件夹是否存在
    if (!toPathExists.exists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `${toPath} is not found`,
        cause: ErrorCode.FILE_NOT_EXSIT,
      });
    }

    const fileNameExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: join(toPath, fileName),
      }),
      this.logger,
    );

    // 判断目标文件夹下是否已存在同名文件
    if (fileNameExists.exists) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `File ${join(toPath, fileName)} already exists.`,
        cause: ErrorCode.FILE_EXSIT,
      });
    }

    const { permission: toPathPermission } = await wrap(
      this.client.file.getFileMetadata({
        userId: this.userId,
        filePath: toPath,
      }),
      this.logger,
    );

    const { canRead, canWrite } = getPermissionsFromMode(toPathPermission);
    if (!canRead) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${toPath} is not readable`,
        cause: ErrorCode.FILE_NOT_READABLE,
      });
    }
    if (!canWrite) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${toPath} is not writable`,
        cause: ErrorCode.FILE_NOT_WRITABLE,
      });
    }
  }

  async checkCreateResourcePath(toPath: string, noCheckPermission?: boolean): Promise<void> {
    const toPathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: toPath,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );
    // 判断目标文件夹是否存在
    if (!toPathExists.exists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `${toPath} is not found`,
        cause: ErrorCode.FILE_NOT_EXSIT,
      });
    }

    const { permission: toPathPermission } = await wrap(
      this.client.file.getFileMetadata({
        userId: this.userId,
        filePath: toPath,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );

    const { canRead, canWrite } = getPermissionsFromMode(toPathPermission);
    if (!canRead) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${toPath} is not readable`,
        cause: ErrorCode.FILE_NOT_READABLE,
      });
    }
    if (!canWrite) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${toPath} is not writable`,
        cause: ErrorCode.FILE_NOT_WRITABLE,
      });
    }
  }

  async checkSharePermission(sourcePath: string, noCheckPermission?: boolean): Promise<void> {
    const sourcePathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: sourcePath,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );

    // 判断目标文件夹是否存在
    if (!sourcePathExists.exists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `${sourcePath} is not found`,
        cause: ErrorCode.FILE_NOT_EXSIT,
      });
    }

    const { permission: toPathPermission } = await wrap(
      this.client.file.getFileMetadata({
        userId: this.userId,
        filePath: sourcePath,
        noCheckPermission: noCheckPermission ?? false,
      }),
      this.logger,
    );

    const { canRead } = getPermissionsFromMode(toPathPermission);
    if (!canRead) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${sourcePath} is not readable`,
        cause: ErrorCode.FILE_NOT_READABLE,
      });
    }
  }
}
