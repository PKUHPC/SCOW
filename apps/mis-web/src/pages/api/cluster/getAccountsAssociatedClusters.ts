import type { UserInfo } from "src/models/User";

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, UserRole } from "src/models/User";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const GetAccountsAssociatedClustersSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    accountNames: Type.Array(Type.String()),
  }),

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

export type GetAccountsAssociatedClustersResponse = Static<
  (typeof GetAccountsAssociatedClustersSchema)["responses"]["200"]
>;

const hasTenantScopePermission = (info: UserInfo) =>
  info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) || info.tenantRoles.length > 0;

const filterAuthorizedAccountNames = (info: UserInfo, accountNames: string[]) => {
  if (hasTenantScopePermission(info)) {
    return accountNames;
  }

  const managedAccountNames = new Set(
    info.accountAffiliations.filter((a) => a.role !== UserRole.USER).map((a) => a.accountName),
  );

  return accountNames.filter((name) => managedAccountNames.has(name));
};

export default route(GetAccountsAssociatedClustersSchema, async (req, res) => {
  const { accountNames } = req.query;
  let authorizedAccountNames: string[] = [];

  const auth = authenticate((u) => {
    authorizedAccountNames = filterAuthorizedAccountNames(u, accountNames);
    return authorizedAccountNames.length > 0;
  });

  const info = await auth(req, res);
  if (!info) {
    return;
  }

  try {
    const client = getScowResourceClient(runtimeConfig.SCOW_RESOURCE_CONFIG.address);
    const { assignedClusterIds } = await client.resource.getAccountsAssignedClusterIds({
      accountNames: authorizedAccountNames,
      tenantName: info.tenant,
    });
    return { 200: { clusterIds: assignedClusterIds ?? [] } };
  } catch (e) {
    const error = mapTRPCExceptionToGRPC(e);
    console.error(
      `Failed to get authorized clusters of ${authorizedAccountNames.length} accounts ` +
        `in ${info.tenant}. ${error.details}`,
    );
    return {
      409: { code: "RESOURCE_CONNECT_FAILED" as const, message: "Get accounts assigned clusters failed." },
    };
  }
});
