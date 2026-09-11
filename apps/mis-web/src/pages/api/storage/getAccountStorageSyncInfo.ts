import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { hasStorageAccess } from "src/utils/storage";

export const AccountStorageSyncInfo = Type.Object({
  syncStarted: Type.Boolean(),
  schedule: Type.String(),
  lastSyncTime: Type.Optional(Type.String()),
});

export type AccountStorageSyncInfo = Static<typeof AccountStorageSyncInfo>;

export const GetAccountStorageSyncInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    storageId: Type.String(),
  }),

  responses: {
    200: AccountStorageSyncInfo,

    403: Type.Null(),
    409: Type.Object({
      code: Type.String(),
    }),
    500: Type.Null(),
  },
});

export default route(GetAccountStorageSyncInfoSchema, async (req, res) => {
  const { storageId } = req.query;

  const auth = authenticate((u) => {
    return u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  if (info.tenant) {
    const resourceClient = getScowResourceClient(runtimeConfig.SCOW_RESOURCE_CONFIG.address);
    try {
      const response = await resourceClient.resource.getTenantAssignedClustersAndPartitions({
        tenantName: info.tenant,
      });

      if (!hasStorageAccess(storageId, Object.keys(response.assignedClusterPartitions))) {
        return { 403: null };
      }
    } catch (e) {
      mapTRPCExceptionToGRPC(e);
      return {
        409: {
          code: "RESOURCE_CONNECT_FAILED" as const,
          message: `Get tenant ${info.tenant} assigned Clusters and Partitions failed.`,
        },
      };
    }
  }

  const client = getClient(StorageServiceClient);

  return asyncUnaryCall(client, "getAccountSyncInfo", {
    storageId, tenant: info.tenant,
  }).then((res) => ({ 200: { ...res } })).catch((e) => console.log("getAccountSyncInfo error", e));
});
