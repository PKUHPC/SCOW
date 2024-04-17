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

import { ConnectError } from "@connectrpc/connect";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { loggedExec, sftpAppendFile, sftpExists, sftpMkdir, sftpReadFile, sftpRealPath, sshRmrf } from "@scow/lib-ssh";
import { FileInfo, fileInfo_FileTypeFromJSON,
  FileServiceServer, FileServiceService, TransferInfo } from "@scow/protos/build/portal/file";
import { FileType } from "@scow/scowd-protos/build/storage/file_pb";
import { clusters } from "src/config/clusters";
import { config } from "src/config/env";
import { scowdClientNotFound } from "src/utils/errors";
import { convertCodeToGrpcStatus, getScowdClient } from "src/utils/scowd";
import { getClusterTransferNode, sshConnect, tryGetClusterTransferNode } from "src/utils/ssh";

export const scowdFileServiceServer = plugin((server) => {

  server.addService<FileServiceServer>(FileServiceService, {
    copy: async ({ request }) => {
      const { userId, cluster, fromPath, toPath } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        await client.file.copy({ fromPath, toPath }, { headers: { IdentityId: userId } });
        return [{}];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while copying file ${fromPath} to ${toPath}`,
        };
      }
    },

    createFile: async ({ request, logger }) => {

      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      const subLogger = logger.child({ userId, cluster });
      subLogger.info("CreateFile started");

      try {
        await client.file.createFile({ filePath: path }, { headers: { IdentityId: userId } });
        return [{}];
      } catch (err) {
        subLogger.error(err);
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while creating file ${path}`,
        };
      }
    },

    deleteDirectory: async ({ request, logger }) => {
      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      const subLogger = logger.child({ userId, cluster });
      subLogger.info("deleteDirectory started");

      try {
        await client.file.deleteDirectory({ dirPath: path }, { headers: { IdentityId: userId } });
        return [{}];
      } catch (err) {
        subLogger.error(err);
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while deleting directory ${path}`,
        };
      }
    },

    deleteFile: async ({ request }) => {

      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        await client.file.deleteFile({ filePath: path }, { headers: { IdentityId: userId } });
        return [{}];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while deleting file ${path}`,
        };
      }
    },

    getHomeDirectory: async ({ request, logger }) => {
      const { cluster, userId } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      const subLogger = logger.child({ userId, cluster });
      subLogger.info("GetHomeDirectory file started");
      try {
        const res = await client.file.getHomeDirectory({}, { headers: { IdentityId: userId } });
        return [{ path: res.path }];
      } catch (err) {
        if (err instanceof ConnectError) {
          subLogger.error(err.message);
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while get ${userId}'s home directory`,
        };
      }
    },

    makeDirectory: async ({ request }) => {
      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        await client.file.makeDirectory({ dirPath: path }, { headers: { IdentityId: userId } });
        return [{}];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while making directory ${path}`,
        };
      }
    },

    move: async ({ request }) => {
      const { userId, cluster, fromPath, toPath } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        await client.file.move({ fromPath, toPath }, { headers: { IdentityId: userId } });
        return [{}];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while moving ${fromPath} to ${toPath}`,
        };
      }
    },

    readDirectory: async ({ request }) => {
      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        const res = await client.file.readDirectory({ dirPath: path }, { headers: { IdentityId: userId } });

        const results: FileInfo[] = res.filesInfo.map((info): FileInfo => {
          return {
            name: info.name,
            type: fileInfo_FileTypeFromJSON(info.fileType),
            mtime: info.modTime,
            mode: info.mode,
            size: Number(info.size),
          };
        });
        return [{ results }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while reading directory ${path}`,
        };
      }
    },

    download: async (call) => {
      const { logger, request: { cluster, path, userId } } = call;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      const subLogger = logger.child({ userId, path, cluster });
      subLogger.info("Download file started");

      try {
        const readStream = await client.file.download({
          path, chunkSize: config.DOWNLOAD_CHUNK_SIZE,
        }, { headers: { IdentityId: userId } });

        for await (const response of readStream) {
          call.write(response);
        }
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw {
          code: status.INTERNAL,
          details: `Error when reading file ${path}`,
        };
      } finally {
        call.end();
        subLogger.info("Download file completed");
      }
    },

    upload: async (call) => {
      const info = await call.readAsync();

      if (info?.message?.$case !== "info") {
        throw <ServiceError> {
          code: status.INVALID_ARGUMENT,
          message: "The first message is not file info",
        };
      }

      const { cluster, path, userId } = info.message?.info;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      class RequestError {
        constructor(
          public code: ServiceError["code"],
          public message: ServiceError["message"],
          public details?: ServiceError["details"],
        ) {}

        toServiceError(): ServiceError {
          return <ServiceError> { code: this.code, message: this.message, details: this.details };
        }
      }

      const logger = call.logger.child({ upload: { userId, path, cluster } });
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
        return [{ writtenBytes: Number(res.writtenBytes) }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw {
          code: status.INTERNAL,
          details: `Error when writing file ${path}`,
        };
      }
    },

    getFileMetadata: async ({ request }) => {
      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        const res = await client.file.getFileMetadata({ filePath: path }, { headers: { IdentityId: userId } });

        return [{ size: Number(res.size), type: res.type === FileType.DIR ? "dir" : "file" }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while getting file ${path} metadata`,
        };
      }
    },

    exists: async ({ request }) => {
      const { userId, cluster, path } = request;

      const client = getScowdClient(cluster);

      if (!client) { throw scowdClientNotFound(cluster); }

      try {
        const res = await client.file.exists({ path: path }, { headers: { IdentityId: userId } });

        return [{ exists: res.exists }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw <ServiceError>{ code: convertCodeToGrpcStatus(err.code), details: err.message };
        }
        throw <ServiceError>{
          code: status.UNKNOWN,
          details: `An unknown error occurred while check file ${path} exists`,
        };
      }
    },

    startFileTransfer: async ({ request, logger }) => {

      const { fromCluster, toCluster, userId, fromPath, toPath } = request;
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
          throw <ServiceError> {
            code: status.INTERNAL,
            message: "scow-sync-start command failed",
            details: resp.stderr,
          };
        }
        return [{}];
      });
    },

    queryFileTransfer: async ({ request, logger }) => {

      const { cluster, userId } = request;

      const transferNodeAddress = getClusterTransferNode(cluster).address;

      return await sshConnect(transferNodeAddress, userId, logger, async (ssh) => {
        const cmd = "scow-sync-query";

        const resp = await loggedExec(ssh, logger, true, cmd, []);
        if (resp.code !== 0) {
          throw <ServiceError> {
            code: status.INTERNAL,
            message: "scow-sync-query command failed",
            details: resp.stderr,
          };
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
        const transferInfosJsons: TransferInfosJson[] = JSON.parse(resp.stdout);
        const transferInfos: TransferInfo[] = [];

        // 根据host确定clusterId
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
          const speedMatch = info.speed.match(/([\d\.]+)([kMGB]?B\/s)/);
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
          throw <ServiceError> {
            code: status.INTERNAL,
            message: "scow-sync-terminate command failed",
            details: resp.stderr,
          };
        }

        return [{}];
      });
    },

    checkTransferKey: async ({ request, logger }) => {

      const { fromCluster, toCluster, userId } = request;

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
            throw <ServiceError> {
              code: status.INTERNAL,
              message: "check the key of transferring cross clusters failed",
              details: resp.stderr,
            };
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
          // eslint-disable-next-line quotes
          const genKeyCmd = `ssh-keygen -N ""`;
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