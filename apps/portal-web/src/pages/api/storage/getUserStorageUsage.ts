import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getServerStorageConfig } from "@scow/config/build/storage";
import { libGetAccountQuotaUsage, libGetUserQuotaUsage } from "@scow/lib-web/build/server/storage";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const StorageInfo = Type.Object({
  storageId: Type.String(),
  quotaMb: Type.Number(),
  usedStorageMb: Type.Number(),
  accountQuotaMb: Type.Optional(Type.Number()),
  accountUsedStorageMb: Type.Optional(Type.Number()),
});

export type StorageInfo = Static<typeof StorageInfo>;

export const getUserStorageInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.Optional(Type.String()),
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

  // cluster 有值时取该集群的配额存储 ID；无值时传空数组（后端查全部）
  let storageIds: string[] = [];
  if (cluster) {
    const clusterConfig = getClusterConfigs(undefined)[cluster];
    if (clusterConfig) {
      const serverStorageConfig = getServerStorageConfig();
      const quotaStorageIds = new Set(
        serverStorageConfig.storages.filter((s) => s.quotaEnabled).map((s) => s.storageId),
      );
      storageIds = (clusterConfig.entryPaths ?? []).map((e) => e.storageId).filter((id) => quotaStorageIds.has(id));
    }
  }

  const { quotaUsage } = await libGetUserQuotaUsage(
    info.identityId,
    storageIds,
    publicConfig.MIS_SERVER_URL,
    runtimeConfig.SCOW_API_AUTH_TOKEN,
  );

  // 查询账户存储配额
  const accountQuotaMap = await libGetAccountQuotaUsage(
    info.identityId,
    quotaUsage.map((u) => u.storageId),
    publicConfig.MIS_SERVER_URL,
    runtimeConfig.SCOW_API_AUTH_TOKEN,
  );

  return {
    200: {
      storageInfos: quotaUsage.map((usage) => {
        const acct = accountQuotaMap[usage.storageId];
        return {
          ...usage,
          ...(acct ? { accountQuotaMb: acct.quotaMb, accountUsedStorageMb: acct.usedStorageMb } : {}),
        };
      }),
    },
  };
});
