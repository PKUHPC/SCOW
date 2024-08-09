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

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { FileInfo_FileType, FileServiceClient } from "@scow/protos/build/portal/file";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const FileType = Type.Union([
  Type.Literal("FILE"),
  Type.Literal("DIR"),
]);

export type FileType = Static<typeof FileType>;

export const FileInfo = Type.Object({
  name: Type.String(),
  type: FileType,
  mtime: Type.String(),
  mode: Type.Number(),
  size: Type.Number(),
});
export type FileInfo = Static<typeof FileInfo>;

export const ListFileSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    updateAccessTime: Type.Optional(Type.Boolean()),
  }),

  responses: {
    200: Type.Object({ items: Type.Array(FileInfo) }),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
    403: Type.Object({ code: Type.Literal("NOT_ACCESSIBLE") }),
    412: Type.Object({ code: Type.Literal("DIRECTORY_NOT_FOUND") }),
  },
});

const auth = authenticate(() => true);

export const mapType = {
  [FileInfo_FileType.DIR]: "DIR",
  [FileInfo_FileType.FILE]: "FILE",
} as const;

export default route(ListFileSchema, async (req, res) => {


  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, path, updateAccessTime } = req.query;

  const client = getClient(FileServiceClient);

  return asyncUnaryCall(client, "readDirectory", {
    cluster, userId: info.identityId, path, updateAccessTime,
  }).then(({ results }) => ({ 200: {
    items: results.map(({ mode, mtime, name, size, type }) => ({
      mode, mtime, name, size, type: mapType[type],
    })) } }), handlegRPCError({
    [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
    [status.PERMISSION_DENIED]: () => ({ 403: { code: "NOT_ACCESSIBLE" as const } }),
    [status.INVALID_ARGUMENT]: () => ({ 412: { code: "DIRECTORY_NOT_FOUND" as const } }),
  }));
});
