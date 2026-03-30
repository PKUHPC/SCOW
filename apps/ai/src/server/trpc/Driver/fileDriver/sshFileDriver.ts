import {
  sftpExists,sftpLstat,sftpMkdir, sftpReaddir,sftpRealPath, sftpRename, sftpStat, sftpUnlink,
  sftpWriteFile,sshRmrf } from "@scow/lib-ssh";
import { loggedExec } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { contentType } from "mime-types";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import path, { basename, dirname, join } from "path";
import { FileInfo } from "src/models/File";
import { config } from "src/server/config/env";
import { FileMeta, ListDirectoryOutput } from "src/server/trpc/model/file";
import { ErrorCode } from "src/server/utils/errorCode";
import { sshConnect } from "src/server/utils/ssh";
import { pipeline, Readable } from "stream";
import { Logger } from "ts-log";
import { promisify } from "util";

import { callback, FileDriver, SHARED_DIR, shareOkCallback, ShareParams } from "./fileDriver";

export class SshFileDriver implements FileDriver {
  constructor(
    private host: string,
    private userId: string,
    private logger: Logger,
  ) {}

  async deleteFile(path: string) {
    await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      await sftpUnlink(sftp)(path);
    });
  }

  async deleteDir(path: string) {
    await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      await sshRmrf(ssh, path);
    });
  }

  async getHomeDirectory() {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      const path = await sftpRealPath(sftp)(".");

      return path;
    });
  }

  async copy(fromPath: string,toPath: string) {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
    // the SFTPWrapper doesn't supprt copy
    // Use command to do it
      const resp = await loggedExec(ssh, this.logger, false, "cp", ["-r", fromPath, toPath]);

      if (resp.code !== 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "cp command failed", cause: resp.stderr });
      }
    });
  }

  async move(fromPath: string,toPath: string) {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      if (await sftpExists(sftp, toPath)) {
        throw new TRPCError({ code: "CONFLICT", message: `${toPath} already exists` });
      }

      const error = await sftpRename(sftp)(fromPath, toPath).catch((e) => e);
      if (error) {
        throw new TRPCError({ code: "CONFLICT", message: "Rename or move failed. " + error });
      }
    });
  }

  async makeDirectory(path: string) {
    await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      if (await sftpExists(sftp, path)) {
        throw new TRPCError({ code: "CONFLICT", message: `${path} already exists` });
      }

      await sftpMkdir(sftp)(path);
    });
  }

  async createFile(path: string): Promise<void> {
    await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      if (await sftpExists(sftp, path)) {
        throw new TRPCError({ code: "CONFLICT", message: `${path} already exists` });
      }

      await sftpWriteFile(sftp)(path, Buffer.alloc(0));
    });
  }

  async readDirectory(path: string): Promise<ListDirectoryOutput[]> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(path).catch((e) => {
        this.logger.error(e, "stat %s as %s failed", path, this.userId);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${path} is not accessible` });
      });

      if (!stat?.isDirectory()) {
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
  }

  async exists(path: string): Promise<boolean> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      const exists = await sftpExists(sftp, path);
      return exists;
    });
  }

  async getFileMetadata(path: string): Promise<FileMeta> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(path).catch((e) => {
        this.logger.error(e, "stat %s as %s failed", path, this.userId);
        throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
      });

      const lstat = await sftpLstat(sftp)(path).catch(() => undefined);
      const isSymlink = !!(lstat && typeof lstat.isSymbolicLink === "function" && lstat.isSymbolicLink());

      const linkTargetPath = isSymlink
        ? await sftpRealPath(sftp)(path).catch(() => undefined)
        : undefined;

      const targetLstat = linkTargetPath
        ? await sftpLstat(sftp)(linkTargetPath).catch(() => undefined)
        : undefined;

      const targetStat = linkTargetPath &&
        !(targetLstat && typeof targetLstat.isSymbolicLink === "function" && targetLstat.isSymbolicLink()) ?
        await sftpStat(sftp)(linkTargetPath).catch(() => undefined) : undefined;

      const linkTargetType = targetLstat && typeof targetLstat.isSymbolicLink === "function" &&
        targetLstat.isSymbolicLink() ?
        "SYMLINK" : (targetStat ? (targetStat.isDirectory() ? "DIR" : "FILE") : undefined);

      return {
        size: stat.size,
        type: isSymlink ? "SYMLINK" : (stat.isDirectory() ? "DIR" : "FILE"),
        isSymlink,
        linkTargetPath,
        linkTargetType,
      };
    });
  }

  async download(path: string,download: string,res: NextApiResponse<any>): Promise<void> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(path).catch((e) => {
        this.logger.error(e, "stat %s as %s failed", path, this.userId);
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
  }

  async decompressFile(filePath: string,decompressionPath: string): Promise<void> {

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

    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(filePath).catch((e) => {
        this.logger.error(e, "stat %s as %s failed", filePath, this.userId);
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
  }

  async compressFiles(): Promise<void> {
    throw new TRPCError({
      code: "METHOD_NOT_SUPPORTED",
      message: "To use this interface, you need to enable scowd.",
    });
  }

  async upload(path: string, uploadedFile: File): Promise<NextResponse<{ message: string; }>> {
    return sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      const writeStream = sftp.createWriteStream(path);

      const pipelineAsync = promisify(pipeline);

      const readableStream = uploadedFile.stream();
      const nodeReadableStream = readableStreamToNodeReadable(readableStream);
      await pipelineAsync(nodeReadableStream, writeStream);

      return NextResponse.json({ message: "success" }, { status: 200 });
    });
  }

  async chmod(path: string, mode: string): Promise<void> {
    await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const resp = await ssh.exec("chmod", ["-R", mode, path], { stream: "both" });

      if (resp.code !== 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "chmod command failed", cause: resp.stderr });
      }
    });
  }

  // 以root身份删除取消分享的文件夹
  async unShareFileOrDir(sharedPath: string,successCallback?: callback,failureCallback?: callback): Promise<void> {
    await sshConnect(this.host, "root", this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      await sftpExists(sftp, sharedPath);
      await sshRmrf(ssh, sharedPath);
      successCallback?.();
    }).catch((err: any) => {
      this.logger.error(`unShare file failed:${err}`);
      failureCallback?.();
    });
  }

  // 以root身份分享的文件夹
  async shareFileOrDir(
    { sourceFilePath,sharedTarget,targetName,targetSubName,sharedTopDir }: ShareParams,
    successCallback?: shareOkCallback,
    failureCallback?: callback): Promise<void> {

    try {
      await sshConnect(this.host, "root", this.logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();
        // 获取类别路径 如 nfs/home/.shared/{userId}/{target}
        const targetDirectory = path.join(sharedTopDir, SHARED_DIR, this.userId, sharedTarget);
        // nfs/home/.shared/{userId}/{target}/{targetName}
        const targetTopDir = path.join(targetDirectory, targetName);
        // nfs/home/.shared/{userId}/{target}/{targetName}/{versionName}
        const targetFullDir = path.join(targetDirectory, targetName, targetSubName);

        // 判断共享目录是否存在
        if (!await sftpExists(sftp, targetDirectory)) {
          await loggedExec(ssh, this.logger, false, "mkdir", ["-p", targetDirectory]);
          await loggedExec(ssh, this.logger, false, "chmod", ["-R", "555", targetDirectory]);
        }

        // 判断目标路径是否存在，如果不存在则创建
        const dirExists = await sftpExists(sftp, targetFullDir);
        if (!dirExists) {
          await loggedExec(ssh, this.logger, false, "mkdir", ["-p", targetFullDir]);
        }

        // 复制并从顶层目录递归修改文件夹权限
        try {
          const cpCmd = "cp";
          const cpParams = ["-r", "--preserve=links", sourceFilePath, targetFullDir];

          try {
            await loggedExec(ssh, this.logger, true, cpCmd, cpParams);
          } catch (err) {
            this.logger.error("Error copying files: %s", err);
            throw err;
          }

          const chmodCmd = "chmod";
          const chmodParams = ["-R", "555", targetTopDir];

          try {
            await loggedExec(ssh, this.logger, true, chmodCmd, chmodParams);
          } catch (err) {
            this.logger.error("Error changing permissions: %s", err);
            throw err;
          }

        } catch (e) {
          this.logger.error("Failed to share %s to %s with error %s", sourceFilePath, targetFullDir, e);
          throw e;
        }

        successCallback?.(targetFullDir);
      });
    } catch (err) {
      this.logger.error("share file failed", err);
      failureCallback?.();
    }
  }

  // 以root身份更新分享的路径
  async getUpdatedSharedPath(newName: string, oldPath: string): Promise<string> {
    return await sshConnect(this.host, "root", this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      // 判断共享目录是否存在
      if (!await sftpExists(sftp, oldPath)) {
        throw new TRPCError({ code: "NOT_FOUND", message: `${oldPath} is not found` });
      }

      const dir = dirname(oldPath);
      const newPath = join(dir, newName);

      await loggedExec(ssh, this.logger, true, "mv", [oldPath, newPath]);

      return newPath;
    });
  }

  async checkCopyFilePath(toPath: string, fileName: string): Promise<void> {
    return await sshConnect(this.host, "root", this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const toPathExists = await sftpExists(sftp, toPath);

      // 判断目标文件夹是否存在
      if (!toPathExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `${toPath} is not found`,
          cause: ErrorCode.FILE_NOT_EXSIT,
        });
      }

      const fileNameExists = await sftpExists(sftp, join(toPath, fileName));

      // 判断目标文件夹下是否已存在同名文件
      if (fileNameExists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `File ${join(toPath, fileName)} already exists.`,
          cause: ErrorCode.FILE_EXSIT,
        });
      }

      // 判断文件是否有读写权限
      const checkReadableResult = await loggedExec(ssh, this.logger, false, "ls", [toPath]);

      if (checkReadableResult.code !== 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${toPath} is not readable, ${checkReadableResult.stderr}`,
          cause: ErrorCode.FILE_NOT_READABLE,
        });
      }

      // 尝试写入文件
      const checkWritableResult
            = await loggedExec(ssh, this.logger, false, "touch", [join(toPath, "test_write_permission_file")]);
      if (checkWritableResult.code !== 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${toPath} is not writable, ${checkWritableResult.stderr}`,
          cause: ErrorCode.FILE_NOT_WRITABLE,
        });
      } else {
        // 删除创建的测试文件
        await loggedExec(ssh, this.logger, false, "rm", [join(toPath, "test_write_permission_file")])
          .catch(() => {
            this.logger.info("Failed to delete %s write permission test file.", toPath);
          });
      }
    });
  }

  async checkCreateResourcePath(toPath: string): Promise<void> {
    return await sshConnect(this.host, "root", this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const toPathExists = await sftpExists(sftp, toPath);

      // 判断目标文件夹是否存在
      if (!toPathExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `${toPath} is not found`,
          cause: ErrorCode.FILE_NOT_EXSIT,
        });
      }

      // 判断文件夹是否有读写权限
      const checkReadableResult = await loggedExec(ssh, this.logger, false, "ls", [toPath]);

      if (checkReadableResult.code !== 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${toPath} is not readable, ${checkReadableResult.stderr}`,
          cause: ErrorCode.FILE_NOT_READABLE,
        });
      }

      // 尝试写入文件
      const checkWritableResult =
      await loggedExec(ssh, this.logger, false, "touch", [join(toPath, "test_write_permission_file")]);

      if (checkWritableResult.code !== 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `${toPath} is not writable, ${checkWritableResult.stderr}`,
          cause: ErrorCode.FILE_NOT_WRITABLE,
        });
      } else {
      // 删除创建的测试文件
        await loggedExec(ssh, this.logger, false, "rm", [join(toPath, "test_write_permission_file")]).catch(() => {
          this.logger.info("Failed to delete %s write permission test file.", toPath);
        });
      }
    });
  }

  async checkSharePermission(sourcePath: string): Promise<void> {
    return await sshConnect(this.host, "root", this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const sourceFileExists = await sftpExists(sftp, sourcePath);
      // 分享时判断源文件是否存在
      if (!sourceFileExists) {
        throw new TRPCError({ code: "NOT_FOUND", message: `${sourcePath} is not found` });
      }

      // 判断是否具有拥有者访问权限
      await sftpStat(sftp)(sourcePath).catch((e) => {
        this.logger.error(e, "stat %s as %s failed", sourcePath, this.userId);
        throw new TRPCError({ code: "FORBIDDEN", message: `${sourcePath} is not accessible` });
      });
    });
  }
}

export function readableStreamToNodeReadable(readableStream: ReadableStream<Uint8Array>) {
  const nodeReadable = new Readable();
  nodeReadable._read = () => {};

  const reader = readableStream.getReader();

  reader.read().then(function processText({ done, value }) {
    if (done) {
      nodeReadable.push(null);
      return;
    }
    nodeReadable.push(Buffer.from(value));
    reader.read().then(processText);
  });

  return nodeReadable;
}

const textFiles = ["application/x-sh"];
export function getContentType(filename: string, defaultValue: string) {
  const type = contentType(basename(filename));

  if (!type) {
    return defaultValue;
  }

  if (textFiles.some((x) => type.startsWith(x))) {
    return "text/plain; charset=utf-8";
  }

  return type;
}
