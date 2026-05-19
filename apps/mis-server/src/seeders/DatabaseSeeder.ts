import type { EntityManager } from "@mikro-orm/core";

import { Seeder } from "@mikro-orm/seeder";
import { DefaultTenantSeeder } from "src/seeders/DefaultTenantSeeder";

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    return this.call(em, [DefaultTenantSeeder]);
  }
}
