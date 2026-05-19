import { createWriterExtensions } from "@ddadaal/tsgrpc-common";
import { ServiceError, status } from "@grpc/grpc-js";
import { quote } from "shell-quote";
import { ShellOps } from "src/clusterops/api/shell";
import { checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { pipeline } from "src/utils/pipeline";
import { sshConnect } from "src/utils/ssh";

export const sshShellServices = (): ShellOps => ({
  shell: async (request, logger) => {
    const { call, cluster, loginNode, userId, path, rows, cols } = request;

    await checkActivatedClusters({ clusterIds: cluster });

    if (!loginNode) {
      throw clusterNotFound(cluster);
    }

    await sshConnect(loginNode, userId, logger, async (ssh) => {
      await ssh.withShell(
        async (channel) => {
          logger.info("Shell requested");

          const { writeAsync } = createWriterExtensions(channel);

          if (path) {
            logger.info("cd to path %s", path);
            await writeAsync(quote(["cd", path]) + "\n");
          }

          channel.on("exit", (...args: [code: string] | [code: null, signal: string]) => {
            logger.info("Shell exited with %o", ...args);

            const hasCode = args[0] !== null;

            call.write({
              message: {
                $case: "exit",
                exit: {
                  code: hasCode ? +args[0] : undefined,
                  signal: hasCode ? undefined : args[1],
                },
              },
            });
          });

          // if either pipeline ends, ends the request
          await Promise.race([
            // shell -> client
            pipeline(
              channel,
              async function (chunk: Uint8Array) {
                return { message: { $case: "data" as const, data: { data: chunk } } };
              },
              call,
            ),

            // client -> shell
            pipeline(
              call.iter(),
              async function (req) {
                if (!req.message) {
                  throw {
                    code: status.INVALID_ARGUMENT,
                    message: "Received a request without message",
                  } as ServiceError;
                }

                if (req.message.$case === "resize") {
                  // 640 and 480 are default values
                  channel.setWindow(req.message.resize.rows, req.message.resize.cols, 480, 640);
                  return;
                }

                if (req.message.$case === "disconnect") {
                  logger.info("Disconnect received from client");
                  call.end();
                  return;
                }

                if (req.message.$case === "data") {
                  logger.info("Received data from client %s", req.message.data.data.toString());
                  return req.message.data.data;
                }

                throw {
                  code: status.INVALID_ARGUMENT,
                  message: `Received unexpected message type ${req.message.$case}`,
                } as ServiceError;
              },
              channel,
            ),
          ]).finally(() => {
            channel.end();
            call.end();
          });
        },
        { cols, rows, term: "xterm-256color" },
      );
    });

    return {};
  },
});
