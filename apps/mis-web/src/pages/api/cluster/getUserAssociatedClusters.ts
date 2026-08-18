import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, TenantRole } from "src/models/User";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const GetUserAssociatedClustersSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      clusterIds: Type.Array(Type.String()),
    }),
    403: Type.Null(),
    409: Type.Object({
      code: Type.Literal("RESOURCE_CONNECT_FAILED"),
      message: Type.String(),
    }),
  },
});

export type GetUserAssociatedClustersResponse = Static<(typeof GetUserAssociatedClustersSchema)["responses"]["200"]>;

export default route(GetUserAssociatedClustersSchema, async (req, res) => {
  const auth = authenticate(
    (u) =>
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
      u.accountAffiliations.length > 0,
  );
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const accountNames = info.accountAffiliations.map((a) => a.accountName);
  const tenantName = info.tenant;
  if (!tenantName || accountNames.length === 0) {
    return { 200: { clusterIds: [] } };
  }

  try {
    const client = getScowResourceClient(runtimeConfig.SCOW_RESOURCE_CONFIG.address);
    const { assignedClusterIds } = await client.resource.getAccountsAssignedClusterIds({
      accountNames,
      tenantName,
    });

    return { 200: { clusterIds: assignedClusterIds ?? [] } };
  } catch (e) {
    const error = mapTRPCExceptionToGRPC(e);
    console.error(
      `Failed to get user accounts' authorized clusters of ${accountNames.length} accounts ` +
        `in ${tenantName}. ${error.details}`,
    );
    return {
      409: { code: "RESOURCE_CONNECT_FAILED" as const, message: "Get user associated clusters failed." },
    };
  }
});
