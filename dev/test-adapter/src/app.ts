import { Server } from "@ddadaal/tsgrpc-server";
import { config } from "src/config/env";
import { accountServiceServer } from "src/services/account";
import { appServiceServer } from "src/services/app";
import { configServiceServer } from "src/services/config";
import { jobServiceServer } from "src/services/job";
import { userServiceServer } from "src/services/user";
import { versionServiceServer } from "src/services/version";

export async function createServer() {
  const server = new Server({
    host: config.HOST,
    port: config.PORT,

    logger: {
      level: config.LOG_LEVEL,
      ...(config.LOG_PRETTY
        ? {
            transport: { target: "pino-pretty" },
          }
        : {}),
    },
  });

  await server.register(accountServiceServer);
  await server.register(userServiceServer);
  await server.register(jobServiceServer);
  await server.register(configServiceServer);
  await server.register(appServiceServer);
  await server.register(versionServiceServer);

  return server;
}
