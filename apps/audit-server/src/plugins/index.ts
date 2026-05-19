// Declares all plugins in this file
// In my yaarxiv project, there can be multiple interface augmentations separated in difference files
// But in this project, only one augmentation is resolved.
// Don't know why.

import type { MikroORM } from "@mikro-orm/core";
import type { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";

import { ormPlugin } from "src/plugins/orm";

declare module "@ddadaal/tsgrpc-server" {
  interface Extensions {
    orm: MikroORM<MySqlDriver>;
  }

  interface Request {
    em: SqlEntityManager<MySqlDriver>;
  }
}

export const plugins = [ormPlugin];
