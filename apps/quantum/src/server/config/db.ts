import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/mysql";
import { SeedManager } from "@mikro-orm/seeder";
import { join } from "node:path";
import { config } from "src/server/config/env";
import { quantumConfig } from "src/server/config/quantum";
import { entities } from "src/server/entities";
import { migrations } from "src/server/migrations";

const distPath = "src/server";

export const ormConfigs = defineConfig({
  host: quantumConfig.db.host,
  port: quantumConfig.db.port,
  user: quantumConfig.db.user,
  dbName: quantumConfig.db.dbName,
  password: config.DB_PASSWORD || quantumConfig.db.password,
  forceUndefined: true,
  extensions: [Migrator, SeedManager],
  migrations: {
    pathTs: join(distPath, "migrations"),
    migrationsList: migrations,
    transactional: false,
  },
  entities: entities,
  debug: quantumConfig.db.debug,
  seeder: {
    path: join(distPath, "seeders"),
  },
});
