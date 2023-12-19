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

import { loggedExec, sftpAppendFile, sftpExists, sftpMkdir, sftpReaddir,
  sftpReadFile, sftpRealPath, sftpRename, sftpStat, sftpUnlink, sftpWriteFile, sshRmrf } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { router } from "src/server/trpc/def";
import { procedure } from "src/server/trpc/procedure/base";
import { clusterNotFound } from "src/server/utils/errors";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode, getClusterTransferNode, sshConnect,
  tryGetClusterTransferNode } from "src/server/utils/ssh";
import { z } from "zod";

import { mock } from "./utils";


export const file = router({
  getHomeDir: procedure
    .meta({
      openapi: {
        method: "GET",
        path: "/file/homeDir",
        tags: ["file"],
        summary: "获取用户家目录路径",
      },
    })
    .input(z.object({ cluster: z.string() }))
    .output(z.object({ path: z.string() }))
    .query(async ({ input: { cluster }, ctx: { user } }) => {

      const host = getClusterLoginNode(cluster);

      if (!host) { throw clusterNotFound(cluster); }

      return await sshConnect(host, user!.identityId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const path = await sftpRealPath(sftp)(".");

        return { path };
      });
    }),


  // deleteItem: procedure
  //   .input(operatorInput.extend({ target: z.enum(["FILE", "DIR"]), path: z.string() }))
  //   .mutation(async ({ input: { target, clusterId, resourceId, path }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         // await asyncUnaryCall(client, target === "FILE" ? "deleteFile" : "deleteDirectory", {
  //         //   clusterId, resourceId,
  //         //   path,
  //         // }, { metadata: setTokenMetadata(token), options: undefined });
  //       },
  //       async () => {
  //       },
  //     );
  //   }),

  // copyOrMove: procedure
  //   .input(operatorInput.extend({ op: z.enum(["copy", "move"]), fromPath: z.string(), toPath: z.string() }))
  //   .mutation(async ({ input: { op, clusterId, resourceId, fromPath, toPath }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         await asyncUnaryCall(client, op, {
  //           clusterId, resourceId,
  //           fromPath, toPath,
  //         }, { metadata: setTokenMetadata(token), options: undefined });
  //       },
  //       async () => {
  //       },
  //     ).catch(handlegRPCError({
  //       [status.ALREADY_EXISTS]: () => {
  //         throw new TRPCError({ code: "CONFLICT" }); },
  //     }));
  //   }),

  // mkdir: procedure
  //   .input(operatorInput.extend({ path: z.string() }))
  //   .mutation(async ({ input: { clusterId, resourceId, path }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         await asyncUnaryCall(client, "makeDirectory", {
  //           clusterId, resourceId,
  //           path,
  //         }, { metadata: setTokenMetadata(token), options: undefined }).catch(handlegRPCError({
  //           [status.ALREADY_EXISTS]: () => { throw new TRPCError({ code: "CONFLICT" }); },
  //         }));
  //       },
  //       async () => {
  //       },
  //     );
  //   }),

  // createFile: procedure
  //   .input(operatorInput.extend({ path: z.string() }))
  //   .mutation(async ({ input: { clusterId, resourceId, path }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         await asyncUnaryCall(client, "createFile", {
  //           clusterId, resourceId,
  //           path,
  //         }, { metadata: setTokenMetadata(token), options: undefined }).catch(handlegRPCError({
  //           [status.ALREADY_EXISTS]: () => { throw new TRPCError({ code: "CONFLICT" }); },
  //         }));
  //       },
  //       async () => {
  //       },
  //     );
  //   }),

  // listDirectory: procedure
  //   .input(operatorInput.extend({ path: z.string() }))
  //   .query(async ({ input: { clusterId, resourceId, path }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         const resp = await asyncUnaryCall(client, "readDirectory", {
  //           clusterId, resourceId,
  //           path,
  //         }, { metadata: setTokenMetadata(token), options: undefined });
  //         return resp.results.map((x) => ({
  //           ...x,
  //           type: x.type === FileInfo_FileType.DIR ? "DIR" as const : "FILE" as const,
  //         }));
  //       },
  //       async () => {
  //         return [];
  //       },
  //     );
  //   }),

  // checkFileExist: procedure
  //   .input(operatorInput.extend({ path: z.string() }))
  //   .query(async ({ input: { clusterId, resourceId, path }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         const resp = await asyncUnaryCall(client, "checkFileExist", {
  //           clusterId, resourceId,
  //           path,
  //         }, { metadata: setTokenMetadata(token), options: undefined });
  //         return { result: resp.result };
  //       },
  //       async () => {
  //         return { result: true };
  //       },
  //     );
  //   }),

  // getFileType: procedure
  //   .input(operatorInput.extend({ path: z.string() }))
  //   .query(async ({ input: { clusterId, resourceId, path }, ctx: { client, token } }) => {
  //     return mock(
  //       async () => {
  //         const resp = await asyncUnaryCall(client, "getFileMetadata", {
  //           clusterId, resourceId,
  //           path,
  //         }, { metadata: setTokenMetadata(token), options: undefined });
  //         return { type: resp.type };
  //       },
  //       async () => {
  //         return { type: "FILE" };
  //       },
  //     );
  //   }),
});

