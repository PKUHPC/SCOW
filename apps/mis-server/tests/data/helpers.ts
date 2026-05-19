import { MikroORM } from "@mikro-orm/core";

export async function dropDatabase(orm: MikroORM) {
  await orm.getSchemaGenerator().dropDatabase(orm.config.get("dbName"));
}

export async function clearAndClose(orm: MikroORM) {
  await dropDatabase(orm);
  await orm.close();
}
