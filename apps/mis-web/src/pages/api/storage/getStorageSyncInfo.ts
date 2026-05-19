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

export const StorageSyncInfo = Type.Object({
  syncStarted: Type.Boolean(),
  schedule: Type.String(),
  lastSyncTime: Type.Optional(Type.String()),
});

export type StorageSyncInfo = Static<typeof StorageSyncInfo>;

export const GetStorageSyncInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
  }),

  responses: {
    200: StorageSyncInfo,

    403: Type.Null(),
    409: Type.Object({
      code: Type.String(),
    }),
    500: Type.Null(),
  },
});

export default route(GetStorageSyncInfoSchema, async (req, res) => {
  const { cluster, path } = req.query;

  const auth = authenticate((u) => {
    return u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  if (runtimeConfig.SCOW_RESOURCE_CONFIG?.enabled && info.tenant) {
    const resourceClient = getScowResourceClient(runtimeConfig.SCOW_RESOURCE_CONFIG.address);
    try {
      const response = await resourceClient.resource.getTenantAssignedClustersAndPartitions({
        tenantName: info.tenant,
      });

      if (!response.assignedClusterPartitions[cluster]) {
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

  return asyncUnaryCall(client, "getSyncInfo", {
    cluster,
    path,
    tenant: info.tenant,
  })
    .then((res) => ({ 200: { ...res } }))
    .catch((e) => console.log("getSyncInfo error", e));
});
