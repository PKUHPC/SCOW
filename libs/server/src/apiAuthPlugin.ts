import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { ScowApiConfigSchema } from "@scow/config/build/common";

export const apiAuthPlugin =
  (config: ScowApiConfigSchema): Plugin =>
  async (s) => {
    if (config.auth?.token) {
      const token = config.auth.token;

      s.addRequestHook(async (call) => {
        const authorizationHeaders = call.metadata.get("authorization");

        if (authorizationHeaders.length === 0) {
          throw new ServiceError({
            code: status.UNAUTHENTICATED,
            message: "SCOW API must be called with proper authentication",
          });
        }

        if (authorizationHeaders.length === 2) {
          throw new ServiceError({
            code: status.INVALID_ARGUMENT,
            message: "Multiple authorization headers received",
          });
        }

        if (authorizationHeaders[0] !== `Bearer ${token}`) {
          throw new ServiceError({
            code: status.UNAUTHENTICATED,
            message: "Token is invalid",
          });
        }
      });
    }
  };
