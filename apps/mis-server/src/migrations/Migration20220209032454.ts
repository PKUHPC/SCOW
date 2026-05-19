/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20220209032454 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `job_price_change` add `new_tenant_price` DECIMAL(19,4) null, add `new_account_price` DECIMAL(19,4) null;",
    );
    this.addSql("update `job_price_change` set `new_tenant_price` = `new_price`, `new_account_price` = `new_price`;");
    this.addSql("alter table `job_price_change` drop `new_price`;");
  }

  async down(): Promise<void> {
    this.addSql("alter table `job_price_change` add `new_price` DECIMAL(19,4) not null;");
    this.addSql("update `job_price_change` set `new_price` = `new_tenant_price`;");
    this.addSql("alter table `job_price_change` drop `new_tenant_price`, drop `new_account_price`;");
  }
}
