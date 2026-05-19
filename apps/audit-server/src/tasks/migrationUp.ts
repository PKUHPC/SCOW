import { MikroORM } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";

export async function migrationUp(orm: MikroORM<MySqlDriver>) {
  await orm.getSchemaGenerator().ensureDatabase();
  await orm.getMigrator().up();
}
