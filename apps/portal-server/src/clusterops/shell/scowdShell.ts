import { ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { getScowdClient } from "@scow/lib-scowd/build/client";
import { ShellOps } from "src/clusterops/api/shell";
import { scowdClientNotFound } from "src/utils/errors";
import { mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { certificates, getLoginNodeScowdUrl } from "src/utils/scowd";

export const scowdShellServices = (): ShellOps => ({
  shell: async (request, logger) => {

    const { call, cluster, loginNode, userId, rows, cols } = request;

    const scowdUrl = getLoginNodeScowdUrl(cluster, loginNode);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${loginNode}` } as ServiceError;
    }

    const client = getScowdClient(scowdUrl, certificates);
    if (!client) { throw scowdClientNotFound(scowdUrl); }

    try {
      const scowdStream = client.shell.shell((async function* () {
        yield { message: { case: "connect", value: { cluster, loginNode, userId, rows, cols } } };

        for await (const data of call.iter()) {

          if (data.message?.$case === "resize") {
            // 640 and 480 are default values
            yield { message: { case: "resize", value: data.message.resize } };
          }

          if (data.message?.$case === "disconnect") {
            logger.info("Disconnect received from client");
            yield { message: { case: "disconnect", value: data.message.disconnect } };
            call.end();
            return;
          }

          if (data.message?.$case === "data") {
            logger.info("Received data from client %s", data.message.data.data.toString());
            yield { message: { case: "data", value: { data: data.message.data.data as Uint8Array<ArrayBuffer> } } };
          }
        }
      })());

      for await (const data of scowdStream) {
        if (!data?.message.case || data?.message.case === "exit") { break; }

        call.write({ message: { $case: data.message.case, data: data.message.value } });
      }

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    } finally {
      call.end();
    }

    return {};
  },
});
