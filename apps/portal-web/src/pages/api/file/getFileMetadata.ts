import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

import { FileType, mapType } from "./list";

export const GetFileMetadataSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
  }),

  responses: {
    200: Type.Object({
      size: Type.Number(),
      type: Type.String(),
      isSymlink: Type.Boolean(),
      linkTargetPath: Type.Optional(Type.String()),
      linkTargetType: Type.Optional(FileType),
    }),
    400: Type.Object({
      code: Type.Union([Type.Literal("INVALID_CLUSTER"), Type.Literal("INVALID_PATH")]),
    }),
  },
});

const auth = authenticate(() => true);

export default route(GetFileMetadataSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, path } = req.query;

  const client = getClient(FileServiceClient);

  return asyncUnaryCall(client, "getFileMetadata", {
    userId: info.identityId,
    cluster,
    path,
  }).then(
    ({ size, type, isSymlink, linkTargetPath, linkTargetType }) => ({
      200: {
        size,
        isSymlink,
        type,
        linkTargetPath,
        linkTargetType: linkTargetType !== undefined ? mapType[linkTargetType] : undefined,
      },
    }),
    handlegRPCError({
      [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
      [status.PERMISSION_DENIED]: () => ({ 400: { code: "INVALID_PATH" as const } }),
    }),
  );
});
