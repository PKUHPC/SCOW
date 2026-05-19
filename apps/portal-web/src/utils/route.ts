import { typeboxRoute } from "@ddadaal/next-typed-api-routes-runtime";
import { Metadata } from "@grpc/grpc-js";

export interface ClusterErrorMetadata {
  clusterId: string;
  details: string;
}

export const route: typeof typeboxRoute = (schema, handler) => {
  return typeboxRoute(schema, async (req, res) => {
    const response = handler(req, res);
    if (response instanceof Promise) {
      return response.catch((e) => {
        if (!(e.metadata instanceof Metadata)) {
          throw e;
        }

        const SCOW_ERROR = (e.metadata as Metadata).get("IS_SCOW_ERROR");
        const SCOW_CAUSE = (e.metadata as Metadata).get("cause");
        if (SCOW_ERROR.length === 0) {
          throw e;
        }

        const code = e.metadata.get("SCOW_ERROR_CODE")?.[0]?.toString();
        const details = e.details;
        const message = SCOW_CAUSE[0];

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

        return { 500: { code, details, message, clusterErrorsArray, currentActivatedClusterIds } } as any;
      });
    }
  });
};
