import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { libGetUserQuotaUsage } from "@scow/lib-web/build/server/storage";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const StorageInfo = Type.Object({
  path: Type.String(),
  quotaBytes: Type.Number(),
  usedStorageBytes: Type.Number(),
});

export type StorageInfo = Static<typeof StorageInfo>;

export const getUserStorageInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    paths: Type.Optional(Type.Array(Type.String())),
  }),

  responses: {
    200: Type.Object({
      storageInfos: Type.Array(StorageInfo),
    }),
  },
});

const auth = authenticate(() => true);

export default route(getUserStorageInfoSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster } = req.query;

  const { quotaUsage } = await libGetUserQuotaUsage(
    info.identityId,
    cluster,
    [],
    publicConfig.MIS_SERVER_URL,
    runtimeConfig.SCOW_API_AUTH_TOKEN,
  );
  return {
    200: { storageInfos: quotaUsage },
  };
});
