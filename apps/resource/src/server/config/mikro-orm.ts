import { join } from "node:path";

import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/mysql";
import { SeedManager } from "@mikro-orm/seeder";
import { entities } from "src/server/entities";

import { migrations } from "../migrations";
import { config } from "./env";
import { resourceConfig } from "./resource";


const distPath = "src/server";

const { host, port, user, dbName, password, debug } = resourceConfig.db;

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
});

