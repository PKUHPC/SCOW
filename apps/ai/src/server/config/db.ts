import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/mysql";
import { SeedManager } from "@mikro-orm/seeder";
import { join } from "node:path";
import { entities } from "src/server/entities";
import { migrations } from "src/server/migrations";

import { aiConfig } from "./ai";
import { config } from "./env";

const distPath = "src/server";

export const ormConfigs = defineConfig({
  host: aiConfig.db.host,
  port: aiConfig.db.port,
  user: aiConfig.db.user,
  dbName: aiConfig.db.dbName,
  password: config.DB_PASSWORD || aiConfig.db.password,
  forceUndefined: true,
  extensions: [Migrator, SeedManager],
  migrations: {
    pathTs: join(distPath, "migrations"),
    migrationsList: migrations,
    transactional: false,
  },
  entities: entities,
  debug: aiConfig.db.debug,
  seeder: {
    path: join(distPath, "seenders"),
  },
});
