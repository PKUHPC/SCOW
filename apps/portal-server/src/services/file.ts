import { ConnectError } from "@connectrpc/connect";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  loggedExec, sftpAppendFile, sftpExists, sftpMkdir,
  sftpReadFile, sftpRealPath, sshRmrf,
} from "@scow/lib-ssh";
import { FileServiceServer, FileServiceService } from "@scow/protos/build/portal/file";
import path from "path";
import { getClusterOps } from "src/clusterops";
import { FileType } from "src/clusterops/api/file";
import { configClusters } from "src/config/clusters";
import { config } from "src/config/env";
import { checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getScowdClient, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { getClusterLoginNode, getClusterTransferNode, sshConnect } from "src/utils/ssh";

export const fileServiceServer = plugin((server) => {

  server.addService<FileServiceServer>(FileServiceService, {
    copy: async ({ request, logger }) => {
      const { userId, cluster, fromPath, toPath } = request;

      // 校验targetPath是否与fromPath自身相同或是fromPath的子目录
      // 因为同名文件与文件夹不可能共存，所以此处不用考虑类型为文件的特殊情况
      const normalizedFromPath = path.normalize(fromPath);
      const normalizedToPath = path.normalize(toPath);
      if (toPath === fromPath || normalizedToPath.startsWith(normalizedFromPath + path.sep)) {
        throw {
          code: Status.INVALID_ARGUMENT,
          details: `Can not copy a directory ${fromPath} to itself or its sub directory ${toPath}`,
        } as ServiceError;
      }

      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      await clusterops.file.copy({ userId, fromPath, toPath }, logger);

      return [{}];
    },

    compressFiles: async ({ request, logger }) => {
      const { cluster, userId, paths, archivePath } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterInfo = configClusters[cluster];

      if (!clusterInfo.scowd?.enabled) {
        throw {
          code: Status.UNIMPLEMENTED,
          message: "To use this interface, you need to enable scowd.",
        } as ServiceError;
      }

      const client = getScowdClient(cluster, userId);

      try {
        logger.info("Starting file compression...");
        await client.file.compressFiles({ userId, paths, archivePath });

        return [{}];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err; }
    },

    createFile: async ({ request, logger }) => {

      const { userId, cluster, path } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      await clusterops.file.createFile({ userId, path }, logger);

      return [{}];
    },

    deleteDirectory: async ({ request, logger }) => {
      const { userId, cluster, path } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      await clusterops.file.deleteDirectory({ userId, path }, logger);

      return [{}];
    },

    deleteFile: async ({ request, logger }) => {

      const { userId, cluster, path } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      await clusterops.file.deleteFile({ userId, path }, logger);

      return [{}];
    },

    getHomeDirectory: async ({ request, logger }) => {
      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      const reply = await clusterops.file.getHomeDirectory({ userId }, logger);

      return [{ ...reply }];
    },

    makeDirectory: async ({ request, logger }) => {
      const { userId, cluster, path } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      await clusterops.file.makeDirectory({ userId, path }, logger);

      return [{}];
    },

    move: async ({ request, logger }) => {
      const { userId, cluster, fromPath, toPath } = request;

      // 校验targetPath是否与fromPath自身相同或是fromPath的子目录
      // 因为同名文件与文件夹不可能共存，所以此处不用考虑类型为文件的特殊情况
      const normalizedFromPath = path.normalize(fromPath);
      const normalizedToPath = path.normalize(toPath);
      if (toPath === fromPath || normalizedToPath.startsWith(normalizedFromPath + path.sep)) {
        throw {
          code: Status.INVALID_ARGUMENT,
          details: `Can not copy a directory ${fromPath} to itself or its sub directory ${toPath}`,
        } as ServiceError;
      }

      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      await clusterops.file.move({ userId, fromPath, toPath }, logger);

      return [{}];
    },

    readDirectory: async ({ request, logger }) => {
      const { userId, cluster, path, updateAccessTime } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      const reply = await clusterops.file.readDirectory({ userId, path, updateAccessTime }, logger);

      return [{ ...reply }];
    },

    download: async (call) => {
      const { logger, request: { cluster, path, userId } } = call;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const subLogger = logger.child({ userId, path, cluster });
      subLogger.info("Download file started");

      const clusterops = getClusterOps(cluster);

      await clusterops.file.download({ userId, path, call }, logger);

    },

    compressAndDownload: async (call) => {
      const { logger, request: { cluster, paths, userId } } = call;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterInfo = configClusters[cluster];

      if (!clusterInfo.scowd?.enabled) {
        throw {
          code: Status.UNIMPLEMENTED,
          message: "To use this interface, you need to enable scowd.",
        } as ServiceError;
      }

      const subLogger = logger.child({ userId, paths, cluster });
      subLogger.info("Download and compress file started");
      const client = getScowdClient(cluster, userId);

      try {
        let clientDisconnected = false;
        const abortController = new AbortController();

        const onCallClose = () => {
          subLogger.info("Client disconnected during compressAndDownload.");
          clientDisconnected = true;
          abortController.abort();
        };
        const onCallError = (err: Error) => {
          subLogger.error(`Error on server stream during compressAndDownload: ${err.message}`);
          clientDisconnected = true;
          abortController.abort();
        };

        const readStream = client.file.compressAndDownload({
          userId, paths, chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
        }, {
          signal: abortController.signal,
        });

        call.on("close", onCallClose);
        call.on("error", onCallError);

        try {
          for await (const response of readStream) {
            if (clientDisconnected || call.destroyed) {
              subLogger.info("compressAndDownload aborted due to client disconnection or stream destruction.");
              break;
            }
            // 如果写入返回 false，表示缓冲区已满，需要等待 `drain` 事件
            if (!call.write(response)) {
              if (clientDisconnected || call.destroyed) {
                subLogger.info("compressAndDownload aborted while write buffer full.");
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
                      subLogger.error(
                        `Error (${err.message}) occurred while waiting for drain during compressAndDownload.`,
                      );
                      reject(err);
                    } else {
                      subLogger.info("Client closed connection while waiting for drain during compressAndDownload.");
                      resolve(); // Resolve to allow loop to break due to clientDisconnected
                    }
                  };
                  call.once("drain", onDrain);
                  call.once("close", onEarlyCloseOrError);
                  call.once("error", onEarlyCloseOrError);
                });
              } catch (drainError) {
                subLogger.error("Error while waiting for drain during compressAndDownload:", drainError);
                break; // Exit loop on drain error
              }
            }
            if (clientDisconnected || call.destroyed) { // Re-check after potential async drain
              subLogger.info("compressAndDownload aborted post-write/drain.");
              break;
            }
          }
        } catch (err) {
          clientDisconnected = true; // Assume disconnection on any readStream error
          if (err instanceof ConnectError) {
            throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
          }
          throw err;
        } finally {
          call.removeListener("close", onCallClose);
          call.removeListener("error", onCallError);
          if (!call.writableEnded && !call.destroyed) {
            subLogger.info("Ensuring call is ended in compressAndDownload finally block.");
            call.end();
          }
        }
      } catch (err) {
        // This outer catch handles errors like checkActivatedClusters or getScowdClient
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        // Ensure call is ended if it was initiated and an error occurred before the inner try/finally
        if (call && !call.writableEnded && !call.destroyed) {
          call.end();
        }
        throw err;
      }
    },

    upload: async (call) => {
      const info = await call.readAsync();

      if (info?.message?.$case !== "info") {
        throw {
          code: status.INVALID_ARGUMENT,
          message: "The first message is not file info",
        } as ServiceError;
      }

      const { cluster, path, userId, chunkIdx } = info.message.info;

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const logger = call.logger.child({ upload: { userId, path, cluster, host } });

      await checkActivatedClusters({ clusterIds: cluster });

      logger.info("Upload file started");

      const clusterops = getClusterOps(cluster);

      const reply = await clusterops.file.upload({ userId, path, chunkIdx, call }, logger);

      return [{ ...reply }];

    },

    decompressFile: async ({ request, logger }) => {
      const { userId, clusterId, filePath, decompressionPath } = request;
      await checkActivatedClusters({ clusterIds: clusterId });

      const host = getClusterLoginNode(clusterId);

      if (!host) { throw clusterNotFound(clusterId); }

      const subLogger = logger.child({ userId, clusterId, filePath, decompressionPath });
      subLogger.info("Decompress file started");

      const clusterops = getClusterOps(clusterId);

      await clusterops.file.decompressFile({ userId, filePath, decompressionPath }, logger);

      return [{}];

    },

    initMultipartUpload: async ({ request }) => {

      const { cluster, userId, path, name, fileSizeByte, modificationTime } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterInfo = configClusters[cluster];

      if (!clusterInfo.scowd?.enabled) {
        throw {
          code: Status.UNIMPLEMENTED,
          message: "To use this interface, you need to enable scowd.",
        } as ServiceError;
      }

      const client = getScowdClient(cluster, userId);

      try {
        const initData = await client.file.initMultipartUpload({
          userId, path, name, fileSizeByte: BigInt(fileSizeByte), modificationTime: BigInt(modificationTime),
        });

        return [{
          ...initData,
          chunkSizeByte: Number(initData.chunkSizeByte),
          fileSizeByte: Number(initData.fileSizeByte),
          modificationTime: Number(initData.modificationTime),
          uploadedIndices: initData.uploadedIndices.map((i) => Number(i)),
        }];

      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    completeMultipartUpload: async ({ request }) => {

      const { userId, cluster, path, name } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterInfo = configClusters[cluster];

      if (!clusterInfo.scowd?.enabled) {
        throw {
          code: Status.UNIMPLEMENTED,
          message: "To use this interface, you need to enable scowd.",
        } as ServiceError;
      }

      const client = getScowdClient(cluster, userId);

      try {
        await client.file.completeMultipartUpload({ userId, path, name });
        return [{}];

      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    getFileMetadata: async ({ request, logger }) => {
      const { userId, cluster, path } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      const reply = await clusterops.file.getFileMetadata({ userId, path }, logger);

      return [{
        ...reply,
        type: reply.type === FileType.DIR ? "dir" : reply.type === FileType.SYMLINK ? "symlink" : "file",
      }];
    },

    exists: async ({ request, logger }) => {
      const { userId, cluster, path } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const clusterops = getClusterOps(cluster);

      const reply = await clusterops.file.exists({ userId, path }, logger);

      return [{ ...reply }];
    },

    startFileTransfer: async ({ request, logger }) => {

      const { fromCluster, toCluster, userId, fromPath, toPath } = request;
      await checkActivatedClusters({ clusterIds: [fromCluster, toCluster]});

      const clusterops = getClusterOps(fromCluster);

      await clusterops.file.startFileTransfer({
        userId, fromCluster, toCluster, fromPath, toPath }, logger);

      return [{}];
    },

    queryFileTransfer: async ({ request, logger }) => {

      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      const { transferInfos } = await clusterops.file.queryFileTransfer({ userId, cluster }, logger);

      return [{ transferInfos: transferInfos }];
    },

    terminateFileTransfer: async ({ request, logger }) => {
      const { fromCluster, toCluster, userId, fromPath } = request;
      await checkActivatedClusters({ clusterIds: [fromCluster, toCluster]});

      const clusterops = getClusterOps(fromCluster);

      await clusterops.file.terminateFileTransfer({
        userId, fromCluster, toCluster, fromPath,
      }, logger);

      return [{}];
    },

    checkTransferKey: async ({ request, logger }) => {

      const { fromCluster, toCluster, userId } = request;

      const host = getClusterLoginNode(fromCluster);

      if (!host) { throw clusterNotFound(fromCluster); }

      const clusterInfo = configClusters[fromCluster];

      if (clusterInfo.scowd?.enabled) {
        throw {
          code: Status.UNIMPLEMENTED,
          message: "Scowd does not implement this interface.",
        } as ServiceError;
      }

      await checkActivatedClusters({ clusterIds: [fromCluster, toCluster]});

      const fromTransferNodeAddress = getClusterTransferNode(fromCluster).address;

      const {
        address: toTransferNodeAddress,
        host: toTransferNodeHost,
        port: toTransferNodePort,
      } = getClusterTransferNode(toCluster);

      // 检查fromTransferNode -> toTransferNode是否已经免密
      const { keyConfigured, scowDir, keyDir, privateKeyPath } = await sshConnect(
        fromTransferNodeAddress, userId, logger, async (ssh) => {
          // 获取密钥路径
          const sftp = await ssh.requestSFTP();
          const homePath = await sftpRealPath(sftp)(".");
          const scowDir = `${homePath}/scow`;
          const keyDir = `${scowDir}/.scow-sync-ssh`;
          const privateKeyPath = `${keyDir}/id_rsa`;

          const cmd = "scow-sync-start";
          const args = [
            "-a", toTransferNodeHost,
            "-u", userId,
            "-p", toTransferNodePort.toString(),
            "-k", privateKeyPath,
            "-c", // -c,--check参数检查是否免密，并stdout返回true/false
          ];

          const resp = await loggedExec(ssh, logger, true, cmd, args);

          if (resp.code !== 0) {
            throw {
              code: status.INTERNAL,
              message: "check the key of transferring cross clusters failed",
              details: resp.stderr,
            } as ServiceError;
          }
          const lines = resp.stdout.trim().split("\n");
          const keyConfigured = lines[lines.length - 1] === "true";

          return {
            keyConfigured: keyConfigured,
            scowDir: scowDir,
            keyDir: keyDir,
            privateKeyPath: privateKeyPath,
          };
        });

      // 如果没有配置免密，则生成密钥并配置免密
      if (!keyConfigured) {
        // 随机生成密钥并复制公钥
        const publicKey = await sshConnect(fromTransferNodeAddress, userId, logger, async (ssh) => {
          const sftp = await ssh.requestSFTP();

          if (!await sftpExists(sftp, scowDir)) {
            await sftpMkdir(sftp)(scowDir);
          }
          if (await sftpExists(sftp, keyDir)) {
            await sshRmrf(ssh, keyDir);
          }
          await sftpMkdir(sftp)(keyDir);

          const genKeyArgs = [
            "-t", "rsa",
            "-b", "4096",
            "-C", "for scow-sync",
            "-f", privateKeyPath,
          ];

          const genKeyCmd = "ssh-keygen -N \"\"";
          await loggedExec(ssh, logger, true, genKeyCmd, genKeyArgs);

          // 读公钥
          const fileData = await sftpReadFile(sftp)(`${privateKeyPath}.pub`);
          return fileData.toString();
        });

        // 配置fromTransferNode -> toTransferNode的免密登录
        await sshConnect(toTransferNodeAddress, userId, logger, async (ssh) => {
          const sftp = await ssh.requestSFTP();
          const homePath = await sftpRealPath(sftp)(".");
          // 将公钥写入到authorized_keys中
          const authorizedKeysPath = `${homePath}/.ssh/authorized_keys`;
          await sftpAppendFile(sftp)(authorizedKeysPath, `\n${publicKey}\n`);
        });

        // 尽管copy了公钥，但第一次ssh连接时，会默认需要输入“yes”。以避免潜在的中间人攻击，但是这导致无法自动化，所以这里需要以非交互的方式ssh短连接一次。
        await sshConnect(fromTransferNodeAddress, userId, logger, async (ssh) => {
          const firstSshArgs = [
            "-i", privateKeyPath,
            "-o", "StrictHostKeyChecking=no",
            "-p", toTransferNodePort.toString(),
            toTransferNodeHost,
            ":",
          ];
          const firstSshCmd = "ssh";
          await loggedExec(ssh, logger, true, firstSshCmd, firstSshArgs);
        });

      }
      return [{}];
    },
  });
});
