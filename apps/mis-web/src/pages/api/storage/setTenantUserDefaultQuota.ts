import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SetTenantUserDefaultQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    userQuotaBytes: Type.Number(),
  }),

  responses: {
    200: Type.Object({
      successes: Type.Number(),
      failures: Type.Number(),
      failedUserIds: Type.Array(Type.String()),
    }),

    400: Type.Null(),
    403: Type.Null(),

    409: Type.Object({
      code: Type.String(),
    }),
  },
});

export default /* #__PURE__*/ route(SetTenantUserDefaultQuotaSchema, async (req, res) => {
  const { cluster, path, userQuotaBytes } = req.body;

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
          message: `Get tenant ${info.tenant} assigned Clusters and Partitions failed.`,
        },
      };
    }
  }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.setTenantUserDefaultQuota,
    operationTypePayload: {
      tenantName: info.tenant,
      cluster,
      path,
      storageQuota: userQuotaBytes,
    },
  };

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "setTenantUserDefaultQuota", {
    tenantName: info.tenant,
    cluster,
    path,
    userQuotaBytes,
  })
    .then(async (res) => {
      await callLog(logInfo, OperationResult.SUCCESS);

      return { 200: { ...res } };
    })
    .catch(
      handlegRPCError(
        {
          [Status.NOT_FOUND]: () => ({ 400: null }),
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
