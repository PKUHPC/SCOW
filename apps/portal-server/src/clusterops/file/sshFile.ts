import { createWriterExtensions } from "@ddadaal/tsgrpc-common";
import { ServiceError, status } from "@grpc/grpc-js";
import { loggedExec, sftpExists, sftpMkdir, sftpReaddir,
  sftpRealPath, sftpRename, sftpStat, sftpUnlink, sftpWriteFile, sshRmrf } from "@scow/lib-ssh";
import { FileInfo, FileInfo_FileType } from "@scow/protos/build/portal/file";
import { join } from "path";
import { FileOps } from "src/clusterops/api/file";
import { config } from "src/config/env";
import { pipeline } from "src/utils/pipeline";
import { sshConnect } from "src/utils/ssh";
import { once } from "stream";

export const sshFileServices = (host: string): FileOps => ({
  copy: async (request, logger) => {
    const { userId, fromPath, toPath } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      // the SFTPWrapper doesn't supprt copy
      // Use command to do it
      const resp = await ssh.exec("cp", ["-r", fromPath, toPath], { stream: "both" });

      if (resp.code !== 0) {
        throw { code: status.INTERNAL, message: "cp command failed", details: resp.stderr } as ServiceError;
      }

      return {};
    });
  },

  createFile: async (request, logger) => {

    const { userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {

      const sftp = await ssh.requestSFTP();

      if (await sftpExists(sftp, path)) {
        throw { code: status.ALREADY_EXISTS, message: `${path} already exists` } as ServiceError;
      }

      await sftpWriteFile(sftp)(path, Buffer.alloc(0));

      return {};
    });
  },

  deleteDirectory: async (request, logger) => {
    const { userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {

      await sshRmrf(ssh, path);

      return {};
    });
  },

  deleteFile: async (request, logger) => {

    const { userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {

      const sftp = await ssh.requestSFTP();

      await sftpUnlink(sftp)(path);

      return {};
    });
  },

  getHomeDirectory: async (request, logger) => {
    const { userId } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const path = await sftpRealPath(sftp)(".");

      return { path };
    });
  },

  makeDirectory: async (request, logger) => {
    const { userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {

      const sftp = await ssh.requestSFTP();

      if (await sftpExists(sftp, path)) {
        throw { code: status.ALREADY_EXISTS, details: `${path} already exists` } as ServiceError;
      }

      await sftpMkdir(sftp)(path);

      return {};
    });

  },

  move: async (request, logger) => {
    const { userId, fromPath, toPath } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      await sftpRename(sftp)(fromPath, toPath).catch((e: unknown) => {
        logger.error(e, "rename %s to %s as %s failed", fromPath, toPath, userId);
        throw { code: status.INTERNAL, message: "rename failed", details: e } as ServiceError;
      });

      return [{}];
    });
  },

  readDirectory: async (request, logger) => {
    const { userId, path, updateAccessTime } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(path).catch((e) => {
        logger.error(e, "stat %s as %s failed", path, userId);
        throw {
          code: status.PERMISSION_DENIED, message: `${path} is not accessible`,
        } as ServiceError;
      });

      if (!stat.isDirectory()) {
        throw {
          code: status.INVALID_ARGUMENT,
          message: `${path} is not directory or not exists` } as ServiceError;
      }

      const files = await sftpReaddir(sftp)(path);
      const list: FileInfo[] = [];

      // 通过touch -a命令实现共享文件系统的缓存刷新
      const pureFiles = files.filter((file) => !file.longname.startsWith("d"));

      if (pureFiles.length > 0 && updateAccessTime) {

        // 避免目录下文件过多导致 touch -a 命令报错，采用分批异步执行的方式
        // 一次执行 500 个文件是根据经验设置的安全值，可修改
        // 根据一般系统 getconf ARG_MAX 的值为 2097152 字节，linux 下带有文件路径的文件名最长 4096 字节 设置安全值为500
        const TOUCH_FILES_COUNT = 500;
        const execFilePathsList: string[][] = [];

        for (let i = 0; i < pureFiles.length; i += TOUCH_FILES_COUNT) {
          const slicedExecFiles = pureFiles.slice(i, i + TOUCH_FILES_COUNT);
          const slicedExecFilesPaths = slicedExecFiles.map((file) => join(path, file.filename));
          execFilePathsList.push(slicedExecFilesPaths);
        }

        await Promise.allSettled(execFilePathsList.map(async (execFilePaths) => {
          return loggedExec(ssh, logger, false, "touch -a", execFilePaths).catch((err) => {
            logger.error(err, "touch -a %s failed as %s", execFilePaths, userId);
          });
        }));

      }

      for (const file of files) {

        const isDir = file.longname.startsWith("d");

        list.push({
          type: isDir ? FileInfo_FileType.DIR : FileInfo_FileType.FILE,
          name: file.filename,
          mtime: new Date(file.attrs.mtime * 1000).toISOString(),
          size: file.attrs.size,
          mode: file.attrs.mode,
        });
      }
      return { results: list };
    });
  },

  download: async (request, logger) => {
    const { userId, path, call } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      const readStream = sftp.createReadStream(path, { highWaterMark: config.DOWNLOAD_CHUNK_SIZE });

      // cannot use pipeline because it forwards error
      // we don't want to forwards error
      // because the error has code property, conflicting with gRPC'S ServiceError
      try {

        await pipeline(
          readStream,
          async (chunk) => {
            return { chunk: Uint8Array.from(Buffer.from(chunk)) };
          },
          call,
        );
      } catch (e) {
        const ex = e as { message: string };
        throw {
          code: status.INTERNAL,
          message: "Error when reading file",
          details: ex?.message,
        } as ServiceError;
      } finally {
        readStream.close(() => {});
        await once(readStream, "close");
        // await promisify(readStream.close.bind(readStream))();
      }

      return {};
    });
  },

  upload: async (request, logger) => {
    const { call, userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      class RequestError extends Error {
        constructor(
          public code: ServiceError["code"],
          public message: ServiceError["message"],
          public details?: ServiceError["details"],
        ) {
          super(message);
        }

        toServiceError(): ServiceError {
          return { code: this.code, message: this.message, details: this.details } as ServiceError;
        }
      }

      try {
        const writeStream = sftp.createWriteStream(path);

        const { writeAsync } = createWriterExtensions(writeStream);

        let writtenBytes = 0;

        for await (const req of call.iter()) {
          if (!req.message) {
            throw new RequestError(
              status.INVALID_ARGUMENT,
              "Request is received but message is undefined",
            );
          }

          if (req.message.$case !== "chunk") {
            throw new RequestError(
              status.INVALID_ARGUMENT,
              `Expect receive chunk but received message of type ${req.message.$case}`,
            );
          }
          await writeAsync(req.message.chunk);
          writtenBytes += req.message.chunk.length;
        }

        // ensure the data is written
        // if (!writeStream.destroyed) {
        //   await new Promise<void>((res, rej) => writeStream.end((e) => e ? rej(e) : res()));
        // }
        writeStream.end();
        await once(writeStream, "close");

        logger.info("Upload complete. Received %d bytes", writtenBytes);

        return { writtenBytes };
      } catch (e: any) {
        if (e instanceof RequestError) {
          throw e.toServiceError();
        } else {
          throw new RequestError(
            status.INTERNAL,
            "Error when writing file",
            e.message,
          ).toServiceError();
        }
      }
    });
  },

  decompressFile: async (request, logger) => {
    const { userId, filePath, decompressionPath } = request;
    const getDecompressionCommand = () => {
      if (filePath.endsWith(".tar")) {
        return `tar -xf ${filePath} -C ${decompressionPath}`;
      } else if (filePath.endsWith(".tar.gz") || filePath.endsWith(".tgz")) {
        return `tar -xzf ${filePath} -C ${decompressionPath}`;
      } else if (filePath.endsWith(".zip")) {
        // TODO: 解压文件中文乱码，暂时指定 为 gbk 编码
        return `unzip -O gbk ${filePath} -d ${decompressionPath}`;
      } else if (filePath.endsWith(".gz")) {
        const fileName = filePath.split("/").pop();
        if (fileName === undefined) {
          throw {
            code: status.INVALID_ARGUMENT,
            message: `${filePath} is an invalid file`,
          } as ServiceError;
        }
        // 获取不带.gz扩展名的文件名
        const outputFile = fileName.substring(0, fileName.length - 3);
        return `gzip -dc ${filePath} > ${decompressionPath}/${outputFile}`;
      } else {
        throw {
          code: status.INVALID_ARGUMENT,
          message: `${filePath} is an unknown file type`,
        } as ServiceError;
      }
    };

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(filePath).catch((e) => {
        logger.error(e, "stat %s as %s failed", filePath, userId);
        throw {
          code: status.PERMISSION_DENIED,
          message: `${filePath} is not accessible`,
        } as ServiceError;
      });

      if (stat.isDirectory()) {
        throw {
          code: status.INVALID_ARGUMENT,
          message: `${filePath} is a directory`,
        } as ServiceError;
      }

      const decompressionCommand = getDecompressionCommand();

      const result = await ssh.execCommand(decompressionCommand);
      if (result.code !== 0) {
        throw {
          code: status.INTERNAL,
          message: `Failed to execute decompression command: ${result.stderr}`,
        } as ServiceError;
      }

      return [{}];
    });
  },

  getFileMetadata: async (request, logger) => {
    const { userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const stat = await sftpStat(sftp)(path).catch((e) => {
        logger.error(e, "stat %s as %s failed", path, userId);
        throw {
          code: status.PERMISSION_DENIED, message: `${path} is not accessible`,
        } as ServiceError;
      });

      return { size: stat.size, type: stat.isDirectory() ? "dir" : "file" };
    });
  },

  exists: async (request, logger) => {
    const { userId, path } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      const exists = await sftpExists(sftp, path);
      return { exists };
    });
  },
});
