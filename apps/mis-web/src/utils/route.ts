import { typeboxRoute } from "@ddadaal/next-typed-api-routes-runtime";
import { Metadata } from "@grpc/grpc-js";
import { Static, Type } from "@sinclair/typebox";

const ClusterErrorMetadata = Type.Object({
  clusterId: Type.String(),
  details: Type.String(),
});

type ClusterErrorMetadata = Static<typeof ClusterErrorMetadata>;

export const ScowErrorResponse = Type.Object({
  code: Type.Optional(Type.String()),
  details: Type.Optional(Type.String()),
  currentActivatedClusterIds: Type.Optional(Type.Array(Type.String())),
  clusterErrorsArray: Type.Optional(Type.Array(ClusterErrorMetadata)),
});

export const route: typeof typeboxRoute = (schema, handler) => {
  return typeboxRoute(schema, async (req, res) => {
    const response = handler(req, res);
    if (response instanceof Promise) {
      return response.catch((e) => {
        if (!(e.metadata instanceof Metadata)) {
          throw e;
        }

        const SCOW_ERROR = e.metadata.get("IS_SCOW_ERROR");
        if (!SCOW_ERROR) {
          throw e;
        }
        const code = e.metadata.get("SCOW_ERROR_CODE")?.[0]?.toString();
        const details = e.details;

        // 如果包含集群详细错误信息
        const clusterErrorsString = e.metadata.get("clusterErrors") ?? undefined;
        const clusterErrorsArray =
          clusterErrorsString && clusterErrorsString.length > 0
            ? (JSON.parse(clusterErrorsString) as ClusterErrorMetadata[])
            : undefined;

        // 如果包含当前在线集群的信息
        const currentActivatedClusterIdsStr = e.metadata.get("currentActivatedClusterIds") ?? undefined;
        const currentActivatedClusterIds =
          currentActivatedClusterIdsStr && currentActivatedClusterIdsStr.length > 0
            ? (JSON.parse(currentActivatedClusterIdsStr) as string[])
            : undefined;

        return { 500: { code, details, currentActivatedClusterIds, clusterErrorsArray } } as any;
      });
    }
  });
};
