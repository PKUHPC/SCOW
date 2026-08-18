import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { GetUsersResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const BatchSetTenantUsersQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    userIds: Type.Array(Type.String()),
    userQuotaBytes: Type.Optional(Type.Number()),
    useTenantDefaultUserQuota: Type.Optional(Type.Boolean()),
  }),

  responses: {
    200: Type.Object({
      failedUserIds: Type.Array(Type.String()),
    }),

    304: Type.Null(),

    400: Type.Null(),
    403: Type.Null(),

    409: Type.Object({
      code: Type.String(),
    }),
  },
});

export default /* #__PURE__*/ route(BatchSetTenantUsersQuotaSchema, async (req, res) => {
  const { cluster, path, userIds, userQuotaBytes, useTenantDefaultUserQuota } = req.body;

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

      if (!response.assignedClusterPartitions[cluster]) {
        return { 403: null };
      }
    } catch (e) {
      mapTRPCExceptionToGRPC(e);
      return {
        409: {
          code: "RESOURCE_CONNECT_FAILED" as const,
          message: `Get tenant ${info?.tenant} assigned Clusters and Partitions failed.`,
        },
      };
    }
  }

  const userClient = getClient(UserServiceClient);
  const { users }: GetUsersResponse = await asyncClientCall(userClient, "getUsers", {
    tenantName: info.tenant,
    userIds,
  });
  if (users.length !== userIds.length) {
    return { 400: null };
  }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.batchSetTenantUsersQuota,
    operationTypePayload: {
      userIds,
      cluster,
      path,
      storageQuota: userQuotaBytes,
      useTenantDefaultUserQuota,
    },
  };

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "batchSetTenantUsersQuota", {
    cluster,
    path,
    userIds,
    userQuotaBytes,
    useTenantDefaultUserQuota,
  })
    .then(async ({ failedUserIds }) => {
      await callLog(logInfo, OperationResult.SUCCESS);

      return { 200: { failedUserIds } };
    })
    .catch(
      handlegRPCError(
        {
          [Status.NOT_FOUND]: () => ({ 400: null }),
          [Status.ALREADY_EXISTS]: () => ({ 304: null }),
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
