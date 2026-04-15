import { ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { FileInfo, fileTypeFromJSON } from "@scow/protos/build/portal/file";
import { DownloadResponse } from "@scow/scowd-protos/build/storage/file_pb";
import { FileOps } from "src/clusterops/api/file";
import { configClusters } from "src/config/clusters";
import { config } from "src/config/env";
import { generateScowdUrl, getScowdClientByUrl, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { getClusterTransferNode, tryGetClusterTransferNode } from "src/utils/ssh";

export const scowdFileServices = (getClient: (userId: string) => ScowdClient): FileOps => ({
  copy: async (request, logger) => {
    const { userId, fromPath, toPath } = request;
    const client = getClient(userId);
    logger.info("Copying %s to %s for user %s", fromPath, toPath, userId);

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

  createFile: async (request, logger) => {

    const { userId, path } = request;
    const client = getClient(userId);
    logger.info("Creating file %s for user %s", path, userId);

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

  deleteDirectory: async (request, logger) => {
    const { userId, path } = request;
    const client = getClient(userId);
    logger.info("Deleting directory %s for user %s", path, userId);

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

  deleteFile: async (request, logger) => {

    const { userId, path } = request;
    const client = getClient(userId);
    logger.info("Deleting file %s for user %s", path, userId);

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
    const client = getClient(userId);

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

  makeDirectory: async (request, logger) => {
    const { userId, path } = request;
    const client = getClient(userId);
    logger.info("Creating directory %s for user %s", path, userId);

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

  move: async (request, logger) => {
    const { userId, fromPath, toPath } = request;
    const client = getClient(userId);
    logger.info("Moving %s to %s for user %s", fromPath, toPath, userId);

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
    const client = getClient(userId);

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
    const client = getClient(userId);

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
      readStream = client.file.download({
        userId, path, chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
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
    const { call, userId, path, chunkIdx } = request;
    const client = getClient(userId);

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
        yield { message: {
          case: "info",
          value: { path, userId, chunkIdx: chunkIdx !== undefined ? BigInt(chunkIdx) : undefined },
        } };

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
    const client = getClient(userId);

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
    const client = getClient(userId);

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

  decompressFile: async (request, logger) => {
    const { userId, filePath, decompressionPath } = request;
    const client = getClient(userId);
    logger.info("Decompressing %s to %s for user %s", filePath, decompressionPath, userId);

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

  startFileTransfer: async (request) => {

    const { fromCluster, toCluster, userId, fromPath, toPath } = request;

    const { host: fromHost, port: fromPort } = getClusterTransferNode(fromCluster);
    const toAddress = getClusterTransferNode(toCluster).address;

    const scowdUrl = generateScowdUrl(fromHost, fromPort);
    const scowdClient = getScowdClientByUrl(scowdUrl);
    try {
      await scowdClient.fileTransfer.startFileTransfer({
        userId, destAddress: toAddress, destPath: toPath, sourcePath: fromPath });

      return {};

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  queryFileTransfer: async (request) => {

    const { cluster, userId } = request;
    try {
      const { host: fromHost, port: fromPort } = getClusterTransferNode(cluster);

      const scowdUrl = generateScowdUrl(fromHost, fromPort);
      const scowdClient = getScowdClientByUrl(scowdUrl);

      const { transferInfos } = await scowdClient.fileTransfer.queryFileTransfer({ userId });

      // 根据host确定clusterId
      const clusters = configClusters;
      return { transferInfos: transferInfos.map((info) => {
        let toCluster = info.toCluster;
        for (const key in clusters) {
          const transferNode = tryGetClusterTransferNode(key);
          if (transferNode) {
            const clusterHost = transferNode.address;
            if (clusterHost === info.toCluster) {
              toCluster = key;
            }
          }
          else {
            continue;
          }
        }
        return {
          ...info,
          toCluster,
          transferSizeKb: Number(info.transferSizeKb),
          remainingTimeSeconds: Number(info.remainingTimeSeconds),
        };
      }) };

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  terminateFileTransfer: async (request) => {
    const { fromCluster, toCluster, userId, fromPath } = request;

    const { host: fromHost, port: fromPort } = getClusterTransferNode(fromCluster);
    const toAddress = getClusterTransferNode(toCluster).address;

    const scowdUrl = generateScowdUrl(fromHost, fromPort);
    const scowdClient = getScowdClientByUrl(scowdUrl);

    try {
      await scowdClient.fileTransfer.terminateFileTransfer({
        userId, destAddress: toAddress, sourcePath: fromPath });

      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },
});
