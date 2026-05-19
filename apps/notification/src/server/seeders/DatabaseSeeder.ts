import { Connection, EntityManager, IDatabaseDriver } from "@mikro-orm/core";
import { Seeder } from "@mikro-orm/seeder";
import { AdminMessageConfigSeeder } from "src/server/seeders/AdminMessageConfigSeeder";

export const DatabaseSeeder = () =>
  class DatabaseSeeder extends Seeder {
    async run(em: EntityManager<IDatabaseDriver<Connection>>): Promise<void> {
      await this.call(em, [AdminMessageConfigSeeder()]);
    }
  };
