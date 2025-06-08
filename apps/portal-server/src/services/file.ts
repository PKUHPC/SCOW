import { ConnectError } from "@connectrpc/connect";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  loggedExec, sftpAppendFile, sftpExists, sftpMkdir,
  sftpReadFile, sftpRealPath, sshRmrf,
} from "@scow/lib-ssh";
import {
  FileInfo, fileInfo_FileTypeFromJSON, FileServiceServer, FileServiceService,
  TransferInfo,
} from "@scow/protos/build/portal/file";
import { getClusterOps } from "src/clusterops";
import { configClusters } from "src/config/clusters";
import { config } from "src/config/env";
import { checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getScowdClient, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { getClusterLoginNode, getClusterTransferNode, sshConnect, tryGetClusterTransferNode } from "src/utils/ssh";

export const fileServiceServer = plugin((server) => {

  server.addService<FileServiceServer>(FileServiceService, {
    copy: async ({ request, logger }) => {
      const { userId, cluster, fromPath, toPath } = request;
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

      const client = getScowdClient(cluster);

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
      const client = getScowdClient(cluster);

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

      const { cluster, path, userId } = info.message.info;

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      const logger = call.logger.child({ upload: { userId, path, cluster, host } });

      await checkActivatedClusters({ clusterIds: cluster });

      logger.info("Upload file started");

      const clusterops = getClusterOps(cluster);

      const reply = await clusterops.file.upload({ userId, path, call }, logger);

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

      const { cluster, userId, path, name } = request;
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

      const client = getScowdClient(cluster);

      try {
        const initData = await client.file.initMultipartUpload({ userId, path, name });

        return [{
          ...initData,
          chunkSizeByte: Number(initData.chunkSizeByte),
          filesInfo: initData.filesInfo.map((info): FileInfo => {
            return {
              name: info.name,
              type: fileInfo_FileTypeFromJSON(info.fileType),
              mtime: info.modTime,
              mode: info.mode,
              size: Number(info.sizeByte),
            };
          }),
        }];

      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    mergeFileChunks: async ({ request }) => {
      const { cluster, userId, path, name, sizeByte } = request;
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

      const client = getScowdClient(cluster);

      try {
        await client.file.mergeFileChunks({ userId, path, name, sizeByte: BigInt(sizeByte) });

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

      return [{ ...reply }];
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

      const fromTransferNodeAddress = getClusterTransferNode(fromCluster).address;
      const {
        host: toTransferNodeHost,
        port: toTransferNodePort,
      } = getClusterTransferNode(toCluster);

      // 执行scow-sync-start
      return await sshConnect(fromTransferNodeAddress, userId, logger, async (ssh) => {
        // 密钥路径
        const sftp = await ssh.requestSFTP();
        const homePath = await sftpRealPath(sftp)(".");
        const privateKeyPath = `${homePath}/scow/.scow-sync-ssh/id_rsa`;

        const cmd = "scow-sync-start";
        const args = [
          "-a", toTransferNodeHost,
          "-u", userId,
          "-s", fromPath,
          "-d", toPath,
          "-m", "2",
          "-p", toTransferNodePort.toString(),
          "-k", privateKeyPath,
        ];

        const resp = await loggedExec(ssh, logger, true, cmd, args);
        if (resp.code !== 0) {
          throw {
            code: status.INTERNAL,
            message: "scow-sync-start command failed",
            details: resp.stderr,
          } as ServiceError;
        }
        return [{}];
      });
    },

    queryFileTransfer: async ({ request, logger }) => {

      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const transferNodeAddress = getClusterTransferNode(cluster).address;

      return await sshConnect(transferNodeAddress, userId, logger, async (ssh) => {
        const cmd = "scow-sync-query";

        const resp = await loggedExec(ssh, logger, true, cmd, []);
        if (resp.code !== 0) {
          throw {
            code: status.INTERNAL,
            message: "scow-sync-query command failed",
            details: resp.stderr,
          } as ServiceError;
        }

        interface TransferInfosJson {
          recvAddress: string,
          filePath: string,
          transferSize: string,
          progress: string,
          speed: string,
          leftTime: string
        }

        // 解析scow-sync-query返回的json数组
        const transferInfosJsons = JSON.parse(resp.stdout) as TransferInfosJson[];
        const transferInfos: TransferInfo[] = [];

        // 根据host确定clusterId
        const clusters = configClusters;
        transferInfosJsons.forEach((info) => {
          let toCluster = info.recvAddress;
          for (const key in clusters) {
            const transferNode = tryGetClusterTransferNode(key);
            if (transferNode) {
              const clusterHost = transferNode.host;
              if (clusterHost === info.recvAddress) {
                toCluster = key;
              }
            }
            else {
              continue;
            }
          }

          // 将json数组中的string类型解析成protos中定义的格式
          let speedInKB = 0;
          const speedMatch = /([\d.]+)([kMGB]?B\/s)/.exec(info.speed);
          if (speedMatch) {
            const speed = Number(speedMatch[1]);
            switch (speedMatch[2]) {
              case "B/s":
                speedInKB = speed / 1024;
                break;
              case "kB/s":
                speedInKB = speed;
                break;
              case "MB/s":
                speedInKB = speed * 1024;
                break;
              case "GB/s":
                speedInKB = speed * 1024 * 1024;
                break;
            }
          }

          const [hours, minutes, seconds] = info.leftTime.split(":").map(Number);
          const leftTimeSeconds = hours * 3600 + minutes * 60 + seconds;
          transferInfos.push({
            toCluster: toCluster,
            filePath: info.filePath,
            transferSizeKb: Math.floor(Number(info.transferSize.replace(/,/g, "")) / 1024),
            progress: Number(info.progress.split("%")[0]),
            speedKBps: speedInKB,
            remainingTimeSeconds: leftTimeSeconds,
          });
        });

        return [{ transferInfos:transferInfos }];
      });
    },

    terminateFileTransfer: async ({ request, logger }) => {
      const { fromCluster, toCluster, userId, fromPath } = request;
      await checkActivatedClusters({ clusterIds: [fromCluster, toCluster]});

      const fromTransferNodeAddress = getClusterTransferNode(fromCluster).address;
      const toTransferNodeHost = getClusterTransferNode(toCluster).host;

      return await sshConnect(fromTransferNodeAddress, userId, logger, async (ssh) => {

        const cmd = "scow-sync-terminate";
        const args = [
          "-a", toTransferNodeHost,
          "-u", userId,
          "-s", fromPath,
        ];

        const resp = await loggedExec(ssh, logger, true, cmd, args);

        if (resp.code !== 0) {
          throw {
            code: status.INTERNAL,
            message: "scow-sync-terminate command failed",
            details: resp.stderr,
          } as ServiceError;
        }

        return [{}];
      });
    },

    checkTransferKey: async ({ request, logger }) => {

      const { fromCluster, toCluster, userId } = request;
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
