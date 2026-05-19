/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20240102091246 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `algorithm` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `owner` varchar(255) not null, `framework` enum('TENSORFLOW', 'PYTORCH', 'KERAS', 'MINDSPORE', 'OTHER') not null, `is_shared` tinyint(1) not null, `description` varchar(255) null, `cluster_id` varchar(255) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `algorithm_version` (`id` int unsigned not null auto_increment primary key, `version_name` varchar(255) not null, `version_description` varchar(255) null, `private_path` varchar(255) not null, `path` varchar(255) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6), `shared_status` varchar(255) not null, `algorithm_id` int unsigned not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `algorithm_version` add index `algorithm_version_algorithm_id_index`(`algorithm_id`);");

    this.addSql(
      "create table `dataset` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `owner` varchar(255) not null, `type` varchar(255) not null, `is_shared` tinyint(1) not null, `scene` varchar(255) not null, `description` varchar(255) null, `cluster_id` varchar(255) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `dataset_version` (`id` int unsigned not null auto_increment primary key, `version_name` varchar(255) not null, `version_description` varchar(255) null, `private_path` varchar(255) not null, `path` varchar(255) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6), `is_shared` tinyint(1) not null, `dataset_id` int unsigned not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `dataset_version` add index `dataset_version_dataset_id_index`(`dataset_id`);");

    this.addSql(
      "create table `image` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `owner` varchar(255) not null, `source` enum('INTERNAL', 'EXTERNAL') not null, `tags` varchar(255) not null, `description` varchar(255) null, `cluster_id` varchar(255) null, `source_path` varchar(255) not null, `path` varchar(255) not null, `is_shared` tinyint(1) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `modal` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `owner` varchar(255) not null, `algorithm_framework` varchar(255) null comment 'algorithm algorithmFramework', `algorithm_name` varchar(255) null comment 'algorithm name', `is_shared` tinyint(1) not null, `description` varchar(255) null, `cluster_id` varchar(255) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `modal_version` (`id` int unsigned not null auto_increment primary key, `version_name` varchar(255) not null, `version_description` varchar(255) null, `algorithm_version` varchar(255) null, `private_path` varchar(255) not null, `path` varchar(255) not null, `create_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) not null default current_timestamp(6), `is_shared` tinyint(1) not null, `modal_id` int unsigned not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `modal_version` add index `modal_version_modal_id_index`(`modal_id`);");

    this.addSql(
      "alter table `algorithm_version` add constraint `algorithm_version_algorithm_id_foreign` foreign key (`algorithm_id`) references `algorithm` (`id`) on update cascade;",
    );

    this.addSql(
      "alter table `dataset_version` add constraint `dataset_version_dataset_id_foreign` foreign key (`dataset_id`) references `dataset` (`id`) on update cascade on delete CASCADE;",
    );

    this.addSql(
      "alter table `modal_version` add constraint `modal_version_modal_id_foreign` foreign key (`modal_id`) references `modal` (`id`) on update cascade;",
    );
  }

  async down(): Promise<void> {
    this.addSql("alter table `algorithm_version` drop foreign key `algorithm_version_algorithm_id_foreign`;");

    this.addSql("alter table `dataset_version` drop foreign key `dataset_version_dataset_id_foreign`;");

    this.addSql("alter table `modal_version` drop foreign key `modal_version_modal_id_foreign`;");

    this.addSql("drop table if exists `algorithm`;");

    this.addSql("drop table if exists `algorithm_version`;");

    this.addSql("drop table if exists `dataset`;");

    this.addSql("drop table if exists `dataset_version`;");

    this.addSql("drop table if exists `image`;");

    this.addSql("drop table if exists `modal`;");

    this.addSql("drop table if exists `modal_version`;");
  }
}
