/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20240304064259 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `account` add `state` enum('FROZEN', 'BLOCKED_BY_ADMIN', 'NORMAL') not null comment 'FROZEN, BLOCKED_BY_ADMIN, NORMAL';",
    );
    this.addSql("alter table `account` change `blocked` `blocked_in_cluster` tinyint(1) not null;");

    this.addSql(`
      UPDATE account a
      SET a.state =
      CASE
        WHEN a.whitelist_id IS NULL AND a.blocked_in_cluster = 1
          AND a.balance > COALESCE(a.block_threshold_amount, (SELECT t.default_account_block_threshold FROM tenant t WHERE a.tenant_id = t.id))
        THEN 'BLOCKED_BY_ADMIN'
        ELSE 'NORMAL'
      END;
    `);
  }

  async down(): Promise<void> {
    this.addSql("alter table `account` drop column `state`;");

    this.addSql("alter table `account` change `blocked_in_cluster` `blocked` tinyint(1) not null;");
  }
}
