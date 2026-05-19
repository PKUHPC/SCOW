/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20250715085254 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `tenant_default_app_removed_list` (`id` int unsigned not null auto_increment primary key, `tenant_id` int unsigned not null, `app_id` varchar(255) not null, `cluster_id` int unsigned not null, `removed_at` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      "alter table `tenant_default_app_removed_list` add index `tenant_default_app_removed_list_tenant_id_index`(`tenant_id`);",
    );
    this.addSql(
      "alter table `tenant_default_app_removed_list` add index `tenant_default_app_removed_list_cluster_id_index`(`cluster_id`);",
    );

    this.addSql(
      "alter table `tenant_default_app_removed_list` add constraint `tenant_default_app_removed_list_tenant_id_foreign` foreign key (`tenant_id`) references `tenant` (`id`) on update cascade;",
    );
    this.addSql(
      "alter table `tenant_default_app_removed_list` add constraint `tenant_default_app_removed_list_cluster_id_foreign` foreign key (`cluster_id`) references `cluster` (`id`) on update cascade on delete cascade;",
    );

    this.addSql(
      "alter table `tenant_app_blacklist` modify `disabled_at` DATETIME(6) not null default current_timestamp(6);",
    );

    this.addSql(
      "alter table `account_app_blacklist` modify `disabled_at` DATETIME(6) not null default current_timestamp(6);",
    );
    this.addSql(
      "alter table `account_app_blacklist` add index `idx_cluster_account_app`(`cluster_id`, `account_id`, `app_id`);",
    );

    // 从 tenant_app_black_list中迁移历史数据
    this.addSql(`
      INSERT INTO tenant_default_app_removed_list
      (tenant_id, app_id, cluster_id, removed_at)
      SELECT
      tenant_id,
      app_id,
      cluster_id,
      disabled_at
      FROM tenant_app_blacklist
      WHERE NOT EXISTS (
      SELECT 1 FROM tenant_default_app_removed_list
      WHERE tenant_default_app_removed_list.tenant_id = tenant_app_blacklist.tenant_id
      AND tenant_default_app_removed_list.app_id = tenant_app_blacklist.app_id
      AND tenant_default_app_removed_list.cluster_id = tenant_app_blacklist.cluster_id
      )
    `);
  }

  override async down(): Promise<void> {
    this.addSql("drop table if exists `tenant_default_app_removed_list`;");

    this.addSql("alter table `account_app_blacklist` drop index `idx_cluster_account_app`;");

    this.addSql(
      "alter table `account_app_blacklist` modify `disabled_at` datetime not null default CURRENT_TIMESTAMP;",
    );

    this.addSql("alter table `tenant_app_blacklist` modify `disabled_at` datetime not null default CURRENT_TIMESTAMP;");
  }
}
