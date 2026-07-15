import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { ShellServiceServer, ShellServiceService } from "@scow/protos/build/portal/shell";
import { getClusterOps } from "src/clusterops";
import { checkUserClusterPermission } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getClusterLoginNode } from "src/utils/ssh";

export const shellServiceServer = plugin((server) => {
  server.addService<ShellServiceServer>(ShellServiceService, {
    shell: async (call) => {
      const firstMessage = await call.readAsync();

      if (firstMessage?.message?.$case !== "connect") {
        throw {
          code: status.INVALID_ARGUMENT,
          message: "The first message is not connect",
        } as ServiceError;
      }

      const {
        message: {
          connect: { cluster, loginNode, userId, path, rows, cols },
        },
      } = firstMessage;

      const host = getClusterLoginNode(cluster);

      if (!host) {
        throw clusterNotFound(cluster);
      }

      const logger = call.logger.child({
        shell: {
          cluster,
          loginNode,
          userId,
        },
      });

      await checkUserClusterPermission({ userId, clusterIds: cluster, logger });

      logger.info("Received shell connection");

      const clusterops = getClusterOps(cluster);

      await clusterops.shell.shell({ call, cluster, loginNode, userId, path, rows, cols }, logger);
    },
  });
});
