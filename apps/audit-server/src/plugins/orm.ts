import { plugin } from "@ddadaal/tsgrpc-server";
import { MikroORM } from "@mikro-orm/core";
import { Migrator } from "@mikro-orm/migrations";
import { defineConfig, MySqlDriver } from "@mikro-orm/mysql";
import { SeedManager } from "@mikro-orm/seeder";
import { join } from "path";
import { auditConfig } from "src/config/audit";
import { config } from "src/config/env";

import { entities } from "../entities";

const distPath = process.env.NODE_ENV === "production" ? "build" : "src";

export const ormConfigs = defineConfig({
  host: auditConfig.db.host,
  port: auditConfig.db.port,
  user: auditConfig.db.user,
  dbName: config.DB_NAME ?? auditConfig.db.dbName,
  password: config.DB_PASSWORD ?? auditConfig.db.password,
  forceUndefined: true,
  extensions: [Migrator, SeedManager],
  migrations: {
    path: join(distPath, "migrations"),
    glob: "*.{js,ts}",
    transactional: false,
  },
  entities,
  debug: auditConfig.db.debug,
  seeder: {
    path: join(distPath, "seenders"),
  },
});

export const ormPlugin = plugin(async (server) => {
  // create the database if not exists.

  const logger = server.logger.child({ plugin: "orm" });

  const orm = await MikroORM.init<MySqlDriver>({
    ...ormConfigs,
    logger: (msg) => logger.info(msg),
  });

  const schemaGenerator = orm.getSchemaGenerator();
  await schemaGenerator.ensureDatabase();
  await orm.getMigrator().up();

  server.addExtension("orm", orm);

  server.addRequestHook((req) => {
    req.em = orm.em.fork();
  });

  server.addCloseHook(async () => {
    logger.info("Closing db connection.");
    await orm.close();
    logger.info("db connection has been closed.");
  });
});
