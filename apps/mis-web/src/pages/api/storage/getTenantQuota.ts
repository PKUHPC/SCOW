import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import {
  mapQuotaSortFieldType,
  mapQuotaSortOrderType,
  QuotaSortFieldType,
  QuotaSortOrderType,
} from "src/models/storage";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";
import { hasStorageAccess } from "src/utils/storage";

export const UserQuotaInfo = Type.Object({
  userId: Type.String(),
  userName: Type.String(),
  quotaMb: Type.Number(),
  usedStorageMb: Type.Number(),
  useDefault: Type.Boolean(),
});

export const TenantQuotaInfo = Type.Object({
  totalUserCount: Type.Number(),
  usersQuotaInfo: Type.Array(UserQuotaInfo),
});

export type UserQuotaInfo = Static<typeof UserQuotaInfo>;
export type TenantQuotaInfo = Static<typeof TenantQuotaInfo>;

export const GetTenantQuotaSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    storageId: Type.String(),
    idOrName: Type.Optional(Type.String()),
    page: Type.Number(),
    pageSize: Type.Optional(Type.Number()),
    sortField: Type.Optional(QuotaSortFieldType),
    sortOrder: Type.Optional(QuotaSortOrderType),
  }),

  responses: {
    200: TenantQuotaInfo,

    403: Type.Null(),
    409: Type.Object({
      code: Type.String(),
    }),
  },
});

export default route(GetTenantQuotaSchema, async (req, res) => {
  const { storageId, idOrName, page, pageSize, sortField, sortOrder } = req.query;

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

  const mappedSortField = sortField ? mapQuotaSortFieldType[sortField] : undefined;
  const mappedSortOrder = sortOrder ? mapQuotaSortOrderType[sortOrder] : undefined;

  const client = getClient(StorageServiceClient);

  return asyncUnaryCall(client, "getTenantQuota", {
    tenantName: info.tenant,
    storageId,
    idOrName,
    page,
    pageSize,
    sortField: mappedSortField,
    sortOrder: mappedSortOrder,
  })
    .then((res) => ({ 200: { ...res } }))
    .catch(handlegRPCError({}));
});
