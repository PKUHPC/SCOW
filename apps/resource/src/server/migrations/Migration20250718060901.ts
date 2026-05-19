/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20250718060901 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "alter table `account_partition_rule` add index `idx_tenant_account_cluster`(`tenant_name`, `account_name`, `cluster_id`);",
    );
    this.addSql(
      "alter table `account_partition_rule` add index `idx_tenant_cluster_partition`(`tenant_name`, `cluster_id`, `partition`);",
    );
  }

  override async down(): Promise<void> {
    this.addSql("alter table `account_partition_rule` drop index `idx_tenant_account_cluster`;");
    this.addSql("alter table `account_partition_rule` drop index `idx_tenant_cluster_partition`;");
  }
}
