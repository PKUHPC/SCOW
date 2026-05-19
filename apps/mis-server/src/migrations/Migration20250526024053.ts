import { Migration } from "@mikro-orm/migrations";
/* eslint-disable @stylistic/max-len */
export class Migration20250526024053 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `tenant_app_blacklist` (`id` int unsigned not null auto_increment primary key, `tenant_id` int unsigned not null, `app_id` varchar(255) not null, `cluster_id` int unsigned not null, `disabled_at` datetime not null default CURRENT_TIMESTAMP, `operator_id` int unsigned null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `tenant_app_blacklist` add index `tenant_app_blacklist_tenant_id_index`(`tenant_id`);");
    this.addSql("alter table `tenant_app_blacklist` add index `tenant_app_blacklist_cluster_id_index`(`cluster_id`);");
    this.addSql(
      "alter table `tenant_app_blacklist` add index `tenant_app_blacklist_operator_id_index`(`operator_id`);",
    );

    this.addSql(
      "create table `account_app_blacklist` (`id` int unsigned not null auto_increment primary key, `account_id` int unsigned not null, `app_id` varchar(255) not null, `cluster_id` int unsigned not null, `disabled_at` datetime not null default CURRENT_TIMESTAMP, `operator_id` int unsigned null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      "alter table `account_app_blacklist` add index `account_app_blacklist_account_id_index`(`account_id`);",
    );
    this.addSql(
      "alter table `account_app_blacklist` add index `account_app_blacklist_cluster_id_index`(`cluster_id`);",
    );
    this.addSql(
      "alter table `account_app_blacklist` add index `account_app_blacklist_operator_id_index`(`operator_id`);",
    );

    this.addSql(
      "alter table `tenant_app_blacklist` add constraint `tenant_app_blacklist_tenant_id_foreign` foreign key (`tenant_id`) references `tenant` (`id`) on update cascade;",
    );
    this.addSql(
      "alter table `tenant_app_blacklist` add constraint `tenant_app_blacklist_cluster_id_foreign` foreign key (`cluster_id`) references `cluster` (`id`) on update cascade on delete cascade;",
    );
    this.addSql(
      "alter table `tenant_app_blacklist` add constraint `tenant_app_blacklist_operator_id_foreign` foreign key (`operator_id`) references `user` (`id`) on update cascade on delete set null;",
    );

    this.addSql(
      "alter table `account_app_blacklist` add constraint `account_app_blacklist_account_id_foreign` foreign key (`account_id`) references `account` (`id`) on update cascade on delete cascade;",
    );
    this.addSql(
      "alter table `account_app_blacklist` add constraint `account_app_blacklist_cluster_id_foreign` foreign key (`cluster_id`) references `cluster` (`id`) on update cascade on delete cascade;",
    );
    this.addSql(
      "alter table `account_app_blacklist` add constraint `account_app_blacklist_operator_id_foreign` foreign key (`operator_id`) references `user` (`id`) on update cascade on delete set null;",
    );
  }

  override async down(): Promise<void> {
    this.addSql("drop table if exists `tenant_app_blacklist`;");

    this.addSql("drop table if exists `account_app_blacklist`;");
  }
}
