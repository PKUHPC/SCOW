import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";
import { hasStorageAccess } from "src/utils/storage";

export const TenantQuotaSummary = Type.Object({
  totalStorageMb: Type.Number(),
  remainingStorageMb: Type.Number(),
  userDefaultQuotaMb: Type.Number(),
  tenantAssignedQuotaMb: Type.Number(),
  tenantUsedStorageMb: Type.Number(),
  mountedClusters: Type.Array(Type.String()),
});

export const GetTenantQuotaSummarySchema = typeboxRouteSchema({
  method: "GET",
  query: Type.Object({
    storageId: Type.String(),
  }),
  responses: {
    200: TenantQuotaSummary,
    403: Type.Null(),
    409: Type.Object({
      code: Type.String(),
    }),
  },
});

export default route(GetTenantQuotaSummarySchema, async (req, res) => {
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

  return asyncUnaryCall(client, "getTenantQuotaSummary", {
    tenantName: info.tenant,
    storageId,
  })
    .then((rpcRes) => ({ 200: { ...rpcRes } }))
    .catch(handlegRPCError({}));
});
