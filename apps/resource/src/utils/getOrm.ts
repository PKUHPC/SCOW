import { EntityManager, MikroORM } from "@mikro-orm/mysql";
import { ormConfigs } from "src/server/config/mikro-orm";

let orm: MikroORM;
/**
 * Returns MikroORM instance.
 * Creates the new if one does not exists, then caches it.
 */
export async function getORM(): Promise<MikroORM> {
  if (orm === undefined) {
    orm = await MikroORM.init(ormConfigs);

    const schemaGenerator = orm.getSchemaGenerator();
    await schemaGenerator.ensureDatabase();
    await orm.getMigrator().up();
    console.log("orm.getMigrator().up()");
  }

  return orm;
}

export async function forkEntityManager(): Promise<EntityManager> {
  const orm = await getORM();

  return orm.em.fork();
}
