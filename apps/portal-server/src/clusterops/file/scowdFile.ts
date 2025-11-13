import { ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { FileInfo, fileTypeFromJSON } from "@scow/protos/build/portal/file";
import { DownloadResponse } from "@scow/scowd-protos/build/storage/file_pb";
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
          type: fileTypeFromJSON(info.fileType),
          mtime: info.modTime,
          mode: info.mode,
          size: Number(info.sizeByte),
          linkTargetPath: info.linkTargetPath,
          linkTargetType: info.linkTargetType !== undefined ?
            fileTypeFromJSON(info.linkTargetType) : undefined,
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

  download: async (request, logger) => {
    const { userId, path, call } = request;
    let readStream: AsyncIterable<DownloadResponse> | undefined;

    let clientDisconnected = false;
    const abortController = new AbortController();

    const onCallClose = () => {
      logger.info(`Client disconnected during download of ${path}.`);
      clientDisconnected = true;
      abortController.abort();
    };

    const onCallError = (err: Error) => {
      logger.error(`Error on server stream for ${path}: ${err.message}`);
      clientDisconnected = true;
      abortController.abort();
    };

    call.on("close", onCallClose);
    call.on("error", onCallError);

    try {
      const { sizeByte } = await client.file.getFileMetadata({ userId, filePath: path });

      // 分段下载，每段 300MB
      const segmentSize = BigInt(300 * 1024 * 1024); // 300MB
      let currentOffset = BigInt(0);

      while (currentOffset < sizeByte) {
        if (clientDisconnected || call.destroyed) {
          logger.info(`Download of ${path} aborted due to client disconnection or stream destruction.`);
          break;
        }

        const remainingBytes = sizeByte - currentOffset;
        const currentLimit = remainingBytes < segmentSize ? remainingBytes : segmentSize;

        logger.info(`Downloading segment of ${path}: offset=${currentOffset}, limit=${currentLimit}`);

        readStream = client.file.download({
          userId,
          path,
          chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
          offsetBytes: currentOffset,
          limitBytes: Number(currentLimit),
        }, {
          signal: abortController.signal,
        });

        for await (const response of readStream) {
          if (clientDisconnected || call.destroyed) {
            logger.info(`Download of ${path} aborted due to client disconnection or stream destruction.`);
            break;
          }

          if (!call.write(response)) {
            if (clientDisconnected || call.destroyed) {
              logger.info(`Download of ${path} aborted while write buffer full.`);
              break;
            }
            try {
              await new Promise<void>((resolve, reject) => {
                const onDrain = () => {
                  call.removeListener("close", onEarlyCloseOrError);
                  call.removeListener("error", onEarlyCloseOrError);
                  resolve();
                };
                const onEarlyCloseOrError = (err?: Error) => {
                  call.removeListener("drain", onDrain);
                  clientDisconnected = true;
                  if (err) {
                    logger.error(`Error (${err.message}) occurred while waiting for drain for ${path}.`);
                    reject(err);
                  } else {
                    logger.info(`Client closed connection while waiting for drain for ${path}.`);
                    resolve();
                  }
                };
                call.once("drain", onDrain);
                call.once("close", onEarlyCloseOrError);
                call.once("error", onEarlyCloseOrError);
              });
            } catch (drainError) {
              logger.error(`Error while waiting for drain for ${path}:`, drainError);
              break;
            }
          }

          if (clientDisconnected || call.destroyed) {
            logger.info(`Download of ${path} aborted post-write/drain.`);
            break;
          }
        }

        if (clientDisconnected || call.destroyed) {
          break;
        }

        currentOffset += currentLimit;
        logger.info(`Completed segment download for ${path}: offset=${currentOffset}/${sizeByte}`);
      }

      if (!clientDisconnected && !call.writableEnded && !call.destroyed) {
        logger.info(`Download of ${path} completed. Ending stream.`);
        call.end();
      } else if (clientDisconnected && !call.writableEnded && !call.destroyed) {
        logger.info(`Download of ${path} was interrupted. Ensuring call is ended.`);
        call.end();
      }

    } catch (err) {
      logger.error(`Unhandled error during download of ${path}:`, err);
      clientDisconnected = true;
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    } finally {
      call.removeListener("close", onCallClose);
      call.removeListener("error", onCallError);

      if (!call.writableEnded && !call.destroyed) {
        logger.warn(`Call for ${path} was not properly ended by logic. Ending in finally.`);
        call.end();
      }
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
      const { sizeByte, type, isSymlink, linkTargetPath, linkTargetType }
        = await client.file.getFileMetadata({ userId, filePath: path });

      return {
        size: Number(sizeByte), type: fileTypeFromJSON(type), isSymlink, linkTargetPath,
        linkTargetType: linkTargetType !== undefined ? fileTypeFromJSON(linkTargetType) : undefined,
      };

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
