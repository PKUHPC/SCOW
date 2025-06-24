import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getScowResourceClient } from "@scow/lib-scow-resource";
import { mapTRPCExceptionToGRPC } from "@scow/lib-scow-resource/build/utils";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AssignedClusterPartitions } from "src/models/cluster";
import { PlatformRole, TenantRole } from "src/models/User";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const PartitionNames = Type.Object({
  partitionNames: Type.Array(Type.String()),
});
export type PartitionNames = Static<typeof PartitionNames>;


export const GetTenantAssignedClustersAndPartitionsSchema = typeboxRouteSchema({
  method: "GET",

  responses: {

    200: Type.Object({
      assignedClusterPartitions:  Type.Record(Type.String(), PartitionNames) }),
    403: Type.Null(),
    409: Type.Object({
      code: Type.Literal("RESOURCE_CONNECT_FAILED"),
      message: Type.String(),
    }),
  },
});

export default route(GetTenantAssignedClustersAndPartitionsSchema,
  async (req, res) => {

    const auth = authenticate((u) => {
      return u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
            u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
    });

    const info = await auth(req, res);
    if (!info) { return; }

    const tenantName = info.tenant;

    let tenantAssignedClustersAndPartitions: AssignedClusterPartitions | undefined;

    if (runtimeConfig.SCOW_RESOURCE_CONFIG?.enabled && tenantName) {
      const resourceClient = getScowResourceClient(runtimeConfig.SCOW_RESOURCE_CONFIG.address);
      try {
        const response = await resourceClient.resource.getTenantAssignedClustersAndPartitions({
          tenantName,
        });
        tenantAssignedClustersAndPartitions = response;
      } catch (e) {
        mapTRPCExceptionToGRPC(e);
        return { 409: { code: "RESOURCE_CONNECT_FAILED" as const,
          message: `Get tenant ${tenantName} assigned Clusters and Partitions failed.` } };
      }
    }

    return { 200: tenantAssignedClustersAndPartitions };
  });
