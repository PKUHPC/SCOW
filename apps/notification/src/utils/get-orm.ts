import type { MikroORM } from "@mikro-orm/core";
import type { MySqlDriver } from "@mikro-orm/mysql";

import { MikroORM as ORM } from "@mikro-orm/core";
import { ormConfigs } from "src/server/config/mikro-orm";
import { DatabaseSeeder } from "src/server/seeders/DatabaseSeeder";

let orm: MikroORM<MySqlDriver>;
/**
 * Returns MikroORM instance.
 * Creates the new if one does not exists, then caches it.
 */
export async function getORM(): Promise<MikroORM<MySqlDriver>> {
  if (orm === undefined) {
    orm = await ORM.init(ormConfigs);

    const schemaGenerator = orm.getSchemaGenerator();
    await schemaGenerator.ensureDatabase();
    await orm.getMigrator().up();

    await orm.getSeeder().seed(DatabaseSeeder());
    console.log("orm.getMigrator().up()");
  }

  return orm;
}

export async function forkEntityManager() {
  const orm = await getORM();

  return orm.em.fork();
}
