import type { EntityManager } from "@mikro-orm/core";

import { Seeder } from "@mikro-orm/seeder";
import { Tenant } from "src/entities/Tenant";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";

export class DefaultTenantSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    // if default tenant exists, don't run
    if (await em.findOne(Tenant, { name: DEFAULT_TENANT_NAME })) {
      return;
    }

    const defaultTenant = new Tenant({ name: DEFAULT_TENANT_NAME });
    await em.persistAndFlush(defaultTenant);
  }
}
