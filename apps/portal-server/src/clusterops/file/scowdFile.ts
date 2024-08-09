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

import { ServiceError, status } from "@grpc/grpc-js";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { FileInfo, fileInfo_FileTypeFromJSON } from "@scow/protos/build/portal/file";
import { FileType } from "@scow/scowd-protos/build/storage/file_pb";
import { FileOps } from "src/clusterops/api/file";
import { config } from "src/config/env";
import { mapTRPCExceptionToGRPC } from "src/utils/scowd";

export const scowdFileServices = (client: ScowdClient): FileOps => ({
  copy: async (request) => {
    const { userId, fromPath, toPath } = request;

    try {
      await client.file.copy({ userId, fromPath, toPath });
      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  createFile: async (request) => {

    const { userId, path } = request;

    try {
      await client.file.createFile({ userId, filePath: path });
      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  deleteDirectory: async (request) => {
    const { userId, path } = request;

    try {
      await client.file.deleteDirectory({ userId, dirPath: path });
      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  deleteFile: async (request) => {

    const { userId, path } = request;

    try {
      await client.file.deleteFile({ userId, filePath: path });
      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  getHomeDirectory: async (request) => {
    const { userId } = request;

    try {
      const res = await client.file.getHomeDirectory({ userId });
      return { path: res.path };
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  makeDirectory: async (request) => {
    const { userId, path } = request;

    try {
      await client.file.makeDirectory({ userId, dirPath: path });
      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  move: async (request) => {
    const { userId, fromPath, toPath } = request;

    try {
      await client.file.move({ userId, fromPath, toPath });
      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
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
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  download: async (request) => {
    const { userId, path, call } = request;

    try {
      const readStream = client.file.download({
        userId, path, chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
      });

      for await (const response of readStream) {
        call.write(response);
      }

      return {};
    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
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
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  getFileMetadata: async (request) => {
    const { userId, path } = request;

    try {
      const res = await client.file.getFileMetadata({ userId, filePath: path });

      return { size: Number(res.sizeByte), type: res.type === FileType.DIR ? "dir" : "file" };

    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },

  exists: async (request) => {
    const { userId, path } = request;

    try {
      const res = await client.file.exists({ userId, path: path });

      return { exists: res.exists };

    } catch (err) {
      throw mapTRPCExceptionToGRPC(err);
    }
  },
});
