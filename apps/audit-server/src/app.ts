import { Server } from "@ddadaal/tsgrpc-server";
import { omitConfigSpec } from "@scow/lib-config";
import { readVersionFile } from "@scow/utils/build/version";
import { config } from "src/config/env";
import { plugins } from "src/plugins";
import { operationLogServiceServer } from "src/services/operationLog";
import { statisticServiceServer } from "src/services/statistic";
import { loggerOptions } from "src/utils/logger";

export async function createServer() {
  const server = new Server({
    host: config.HOST,
    port: config.PORT,

    logger: loggerOptions,
  });

  server.logger.info({ version: readVersionFile() }, "@scow/audit-server: ");
  server.logger.info({ config: omitConfigSpec(config) }, "Loaded env config");

  for (const plugin of plugins) {
    await server.register(plugin);
  }
  await server.register(operationLogServiceServer);
  await server.register(statisticServiceServer);
  return server;
}
