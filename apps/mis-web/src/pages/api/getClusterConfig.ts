import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { Partition } from "src/models/cluster";
import { PlatformRole, TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const GetClusterConfigSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      partitions: Type.Array(Partition),
    }),
  },
});

export default route(GetClusterConfigSchema, async (req, res) => {
  if (await queryIfInitialized()) {
    const auth = authenticate((u) =>
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    );
    const info = await auth(req, res);
    if (!info) return;
  }

  const { cluster } = req.query;

  const client = getClient(ConfigServiceClient);

  const partitions = await asyncClientCall(client, "getClusterConfig", { cluster }).then((resp) => {
    return resp.partitions;
  }).catch((e) => {
    console.error(`Cluster ops fails at ${cluster}, error details: ${e}`);
    throw e;
  });

  return {
    200: { partitions },
  };
});
