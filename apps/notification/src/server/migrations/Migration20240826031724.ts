/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20240826031724 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `admin_message_configs` (`id` int unsigned not null auto_increment primary key, `notice_type` tinyint not null, `message_type` varchar(255) not null, `enabled` tinyint(1) not null, `can_user_modify` tinyint(1) not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      "alter table `admin_message_configs` add index `admin_message_configs_notice_type_message_type_index`(`notice_type`, `message_type`);",
    );

    this.addSql(
      "create table `api_keys` (`id` int unsigned not null auto_increment primary key, `app_id` varchar(255) not null, `name` varchar(255) not null, `key` varchar(255) not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `api_keys` add unique `api_keys_key_unique`(`key`);");

    this.addSql(
      "create table `custom_message_types` (`id` int unsigned not null auto_increment primary key, `type` varchar(255) not null, `title_template` json not null, `content_template` json not null, `category` varchar(255) not null comment '消息类型分类，例如账户通知、作业通知等', `category_template` json not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `custom_message_types` add index `custom_message_types_type_index`(`type`);");
    this.addSql("alter table `custom_message_types` add unique `custom_message_types_type_unique`(`type`);");
    this.addSql("alter table `custom_message_types` add index `custom_message_types_category_index`(`category`);");

    this.addSql(
      "create table `messages` (`id` int unsigned not null auto_increment primary key, `sender_type` tinyint not null, `sender_id` varchar(255) not null, `target_type` tinyint not null, `metadata` json not null, `description_data` text not null, `message_type` varchar(255) not null, `category` varchar(255) not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `messages` add index `messages_sender_type_index`(`sender_type`);");
    this.addSql("alter table `messages` add index `messages_sender_id_index`(`sender_id`);");

    this.addSql(
      "create table `message_targets` (`id` int unsigned not null auto_increment primary key, `notice_types` text not null, `target_type` tinyint not null, `target_id` varchar(255) null, `message_id` int unsigned not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `message_targets` add index `message_targets_target_type_index`(`target_type`);");
    this.addSql("alter table `message_targets` add index `message_targets_target_id_index`(`target_id`);");
    this.addSql("alter table `message_targets` add index `message_targets_message_id_index`(`message_id`);");

    this.addSql(
      "create table `user_message_read` (`id` int unsigned not null auto_increment primary key, `user_id` varchar(255) not null, `message_id` int unsigned not null, `status` tinyint not null, `read_time` datetime null, `is_deleted` tinyint(1) not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `user_message_read` add index `user_message_read_message_id_index`(`message_id`);");
    this.addSql("alter table `user_message_read` add index `idx_user_id`(`user_id`);");

    this.addSql(
      "create table `user_subscriptions` (`id` int unsigned not null auto_increment primary key, `user_id` varchar(255) not null, `notice_type` tinyint not null, `message_type` varchar(255) not null, `is_subscribed` tinyint(1) not null, `created_at` DATETIME(6) not null, `updated_at` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql(
      "alter table `user_subscriptions` add index `user_subscriptions_notice_type_message_type_index`(`notice_type`, `message_type`);",
    );

    this.addSql(
      "alter table `message_targets` add constraint `message_targets_message_id_foreign` foreign key (`message_id`) references `messages` (`id`) on update cascade;",
    );

    this.addSql(
      "alter table `user_message_read` add constraint `user_message_read_message_id_foreign` foreign key (`message_id`) references `messages` (`id`) on update cascade;",
    );
  }

  async down(): Promise<void> {
    this.addSql("alter table `message_targets` drop foreign key `message_targets_message_id_foreign`;");

    this.addSql("alter table `user_message_read` drop foreign key `user_message_read_message_id_foreign`;");

    this.addSql("drop table if exists `admin_message_configs`;");

    this.addSql("drop table if exists `api_keys`;");

    this.addSql("drop table if exists `custom_message_types`;");

    this.addSql("drop table if exists `messages`;");

    this.addSql("drop table if exists `message_targets`;");

    this.addSql("drop table if exists `user_message_read`;");

    this.addSql("drop table if exists `user_subscriptions`;");
  }
}
