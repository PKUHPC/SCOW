import {
  sftpExists,
  sftpMkdir, sftpReaddir,
  sftpRealPath, sftpRename, sftpStat, sftpUnlink, sftpWriteFile, sshRmrf,
} from "@scow/lib-ssh";
import { loggedExec } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { contentType } from "mime-types";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { basename } from "path";
import { FileInfo } from "src/models/File";
import { config } from "src/server/config/env";
import { logger } from "src/server/utils/logger";
import { sshConnect } from "src/server/utils/ssh";
import { pipeline, Readable } from "stream";
import { Logger } from "ts-log";
import { promisify } from "util";

import { FileMeta, ListDirectoryOutput } from "../model/file";
import { FileDriver } from "./fileDriver";

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
      const resp = await loggedExec(ssh, logger, false, "cp", ["-r", fromPath, toPath]);

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
        logger.error(e, "stat %s as %s failed", path, this.userId);
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
        logger.error(e, "stat %s as %s failed", path, this.userId);
        throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
      });

      return { size: stat.size, type: stat.isDirectory() ? "dir" : "file" };
    });
  }

  async download(path: string,download: string,res: NextApiResponse<any>): Promise<void> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(path).catch((e) => {
        logger.error(e, "stat %s as %s failed", path, this.userId);
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
        logger.error(e, "stat %s as %s failed", filePath, this.userId);
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
