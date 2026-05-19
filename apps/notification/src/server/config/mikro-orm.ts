import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/mysql";
import { SeedManager } from "@mikro-orm/seeder";
import { join } from "node:path";
import { config } from "src/server/config/env";
import { entities } from "src/server/entities";
import { migrations } from "src/server/migrations";

import { notificationConfig } from "./notification";

const distPath = "src/server";

const { host, port, user, dbName, password, debug, pool } = notificationConfig.db;

export const ormConfigs = defineConfig({
  host,
  port,
  user,
  dbName,
  password: config.DB_PASSWORD || password,
  forceUndefined: true,
  extensions: [Migrator, SeedManager],
  migrations: {
    pathTs: join(distPath, "migrations"),
    migrationsList: migrations,
    transactional: false,
  },
  entities: entities,
  debug,
  pool,
});
