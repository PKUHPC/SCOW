import { ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { FileInfo, fileInfo_FileTypeFromJSON } from "@scow/protos/build/portal/file";
import { FileType } from "@scow/scowd-protos/build/storage/file_pb";
import { FileOps } from "src/clusterops/api/file";
import { config } from "src/config/env";
import { mapConnectRpcStatusToGrpc } from "src/utils/scowd";

export const scowdFileServices = (client: ScowdClient): FileOps => ({
  copy: async (request) => {
    const { userId, fromPath, toPath } = request;

    try {
      await client.file.copy({ userId, fromPath, toPath });
      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  createFile: async (request) => {

    const { userId, path } = request;

    try {
      const { exists } = await client.file.exists({ userId, path });

      if (exists) {
        throw { code: status.ALREADY_EXISTS, details: `${path} already exists` } as ServiceError;
      }
      
      await client.file.createFile({ userId, filePath: path });
      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  deleteDirectory: async (request) => {
    const { userId, path } = request;

    try {
      await client.file.deleteDirectory({ userId, dirPath: path });
      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  deleteFile: async (request) => {

    const { userId, path } = request;

    try {
      await client.file.deleteFile({ userId, filePath: path });
      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  getHomeDirectory: async (request) => {
    const { userId } = request;

    try {
      const res = await client.file.getHomeDirectory({ userId });
      return { path: res.path };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  makeDirectory: async (request) => {
    const { userId, path } = request;

    try {
      const { exists } = await client.file.exists({ userId, path });

      if (exists) {
        throw { code: status.ALREADY_EXISTS, details: `${path} already exists` } as ServiceError;
      }

      await client.file.makeDirectory({ userId, dirPath: path });
      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  move: async (request) => {
    const { userId, fromPath, toPath } = request;

    try {
      await client.file.move({ userId, fromPath, toPath });
      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  readDirectory: async (request) => {
    const { userId, path } = request;

    try {
      const res = await client.file.readDirectory({ userId, dirPath: path });

      const results: FileInfo[] = res.filesInfo.map((info): FileInfo => {
        return {
          name: info.name,
          type: fileInfo_FileTypeFromJSON(info.fileType),
          mtime: info.modTime,
          mode: info.mode,
          size: Number(info.sizeByte),
        };
      });
      return { results };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  download: async (request) => {
    const { userId, path, call } = request;

    try {
      const readStream = client.file.download({
        userId, path, chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
      });

      for await (const response of readStream) {
        // 如果写入返回 false，表示缓冲区已满，需要等待 `drain` 事件
        if (!call.write(response)) {
          await new Promise((resolve) => call.once("drain", resolve));
        }
      }
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    } finally {
      call.end();
    }

    return {};
  },

  upload: async (request, logger) => {
    const { call, userId, path } = request;

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

    logger.info("Upload file started");

    try {
      const res = await client.file.upload((async function* () {
        yield { message: { case: "info", value: { path, userId } } };

        for await (const data of call.iter()) {
          if (data.message?.$case !== "chunk") {
            throw new RequestError(
              status.INVALID_ARGUMENT,
              `Expect receive chunk but received message of type ${data.message?.$case}`,
            );
          }
          yield { message: { case: "chunk", value: data.message.chunk } };
        }
      })());
      return { writtenBytes: Number(res.writtenBytes) };

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  getFileMetadata: async (request) => {
    const { userId, path } = request;

    try {
      const res = await client.file.getFileMetadata({ userId, filePath: path });

      return { size: Number(res.sizeByte), type: res.type === FileType.DIR ? "dir" : "file" };

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  exists: async (request) => {
    const { userId, path } = request;

    try {
      const res = await client.file.exists({ userId, path: path });

      return { exists: res.exists };

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  decompressFile: async (request) => {
    const { userId, filePath, decompressionPath } = request;

    try {
      await client.file.decompressFile({
        userId, filePath, decompressionPath,
      });
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }

    return {};
  },
});
