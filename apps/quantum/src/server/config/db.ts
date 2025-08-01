/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { join } from "node:path";

import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/mysql";
import { SeedManager } from "@mikro-orm/seeder";
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

