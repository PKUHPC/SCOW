import { Server } from "@ddadaal/tsgrpc-server";
import { omitConfigSpec } from "@scow/lib-config";
import { readVersionFile } from "@scow/utils/build/version";
import { config } from "src/config/env";
import { plugins } from "src/plugins";
import { accountServiceServer } from "src/services/account";
import { adminServiceServer } from "src/services/admin";
import { appAuthorizationServiceServer } from "src/services/appAuthorization";
import { billServiceServer } from "src/services/bill";
import { chargingServiceServer } from "src/services/charging";
import { configServiceServer } from "src/services/config";
import { exportServiceServer } from "src/services/export";
import { initServiceServer } from "src/services/init";
import { jobServiceServer } from "src/services/job";
import { appTemplateServiceServer } from "src/services/appTemplate";
import { jobTemplateServiceServer } from "src/services/jobTemplate";
import { jobChargeLimitServer } from "src/services/jobChargeLimit";
import { misConfigServiceServer } from "src/services/misConfig";
import { quantumServiceServer } from "src/services/quantum";
import { storageServiceServer } from "src/services/storage";
import { tenantServiceServer } from "src/services/tenant";
import { userServiceServer } from "src/services/user";
import { loggerOptions } from "src/utils/logger";

export async function createServer() {
  const server = new Server({
    host: config.HOST,
    port: config.PORT,
    logger: loggerOptions,
    grpcServerOptions: {
      // 连接空闲超时配置 - 30分钟后关闭空闲连接
      "grpc.max_connection_idle_ms": 30 * 60 * 1000,
      // 连接最大存活时间 - 2小时后强制关闭连接
      "grpc.max_connection_age_ms": 2 * 60 * 60 * 1000,
      // 连接最大存活时间的宽限期 - 5分钟
      "grpc.max_connection_age_grace_ms": 5 * 60 * 1000,
    },
  });

  server.logger.info({ version: readVersionFile() }, "@scow/mis-server: ");
  server.logger.info({ config: omitConfigSpec(config) }, "Loaded env config");

  for (const plugin of plugins) {
    await server.register(plugin);
  }

  await server.register(accountServiceServer);
  await server.register(userServiceServer);
  await server.register(adminServiceServer);
  await server.register(initServiceServer);
  await server.register(jobChargeLimitServer);
  await server.register(jobServiceServer);
  await server.register(chargingServiceServer);
  await server.register(tenantServiceServer);
  await server.register(configServiceServer);
  await server.register(misConfigServiceServer);
  await server.register(exportServiceServer);
  await server.register(billServiceServer);
  await server.register(storageServiceServer);
  await server.register(appAuthorizationServiceServer);
  await server.register(quantumServiceServer);
  await server.register(jobTemplateServiceServer);
  await server.register(appTemplateServiceServer);

  return server;
}
