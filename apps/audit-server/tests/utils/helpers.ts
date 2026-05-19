import { MikroORM } from "@mikro-orm/core";

export async function dropDatabase(orm: MikroORM) {
  await orm.getSchemaGenerator().dropDatabase(orm.config.get("dbName"));
}
