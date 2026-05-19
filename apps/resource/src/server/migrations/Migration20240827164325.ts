/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20240827164325 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `account_cluster_rule` (`id` int unsigned not null auto_increment primary key, `account_name` varchar(255) not null, `tenant_name` varchar(255) not null, `cluster_id` varchar(255) not null, `create_time` DATETIME(6) not null, `update_time` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `account_partition_rule` (`id` int unsigned not null auto_increment primary key, `account_name` varchar(255) not null, `tenant_name` varchar(255) not null, `cluster_id` varchar(255) not null, `partition` varchar(255) not null, `create_time` DATETIME(6) not null, `update_time` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `tenant_cluster_rule` (`id` int unsigned not null auto_increment primary key, `tenant_name` varchar(255) not null, `cluster_id` varchar(255) not null, `is_account_default_cluster` tinyint(1) not null default false, `create_time` DATETIME(6) not null, `update_time` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `tenant_cluster_rule` add index `tenant_cluster_rule_tenant_name_index`(`tenant_name`);");

    this.addSql(
      "create table `tenant_partition_rule` (`id` int unsigned not null auto_increment primary key, `tenant_name` varchar(255) not null, `cluster_id` varchar(255) not null, `partition` varchar(255) not null, `is_account_default_partition` tinyint(1) not null default false, `create_time` DATETIME(6) not null, `update_time` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      "alter table `tenant_partition_rule` add index `tenant_partition_rule_tenant_name_index`(`tenant_name`);",
    );
  }

  async down(): Promise<void> {
    this.addSql("drop table if exists `account_cluster_rule`;");

    this.addSql("drop table if exists `account_partition_rule`;");

    this.addSql("drop table if exists `tenant_cluster_rule`;");

    this.addSql("drop table if exists `tenant_partition_rule`;");
  }
}
