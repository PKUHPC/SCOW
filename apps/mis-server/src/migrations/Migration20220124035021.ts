/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20220124035021 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `charge_record` (`id` int unsigned not null auto_increment primary key, `time` datetime not null, `tenant_name` varchar(255) not null, `account_name` varchar(255) null, `type` varchar(255) not null, `amount` DECIMAL(19,4) not null, `comment` varchar(255) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `pay_record` (`id` int unsigned not null auto_increment primary key, `time` DATETIME(6) not null, `tenant_name` varchar(255) not null, `account_name` varchar(255) null, `type` varchar(255) not null, `amount` DECIMAL(19,4) not null, `operator_id` varchar(255) not null, `ip_address` varchar(255) not null, `comment` varchar(255) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `job_price_change` (`id` int unsigned not null auto_increment primary key, `jobs` json not null comment '{ biJobIndex: number; tenantPrice: tenantPrice.toFixed(4), accountPrice: accountPrice.toFixed(4) }[]', `reason` varchar(255) not null, `new_price` DECIMAL(19,4) not null, `operator_id` varchar(255) not null, `ip_address` varchar(255) not null, `time` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `job_info` (`bi_job_index` int unsigned not null auto_increment primary key, `id_job` int(11) not null, `account` varchar(20) not null comment '账户', `user` varchar(20) not null comment '用户名', `partition` tinytext not null comment '分区', `nodelist` text not null comment '使用节点列表', `job_name` tinytext not null comment '作业名', `cluster` varchar(50) not null comment '集群名', `time_submit` datetime not null comment '提交时间', `time_start` datetime not null comment '开始时间', `time_end` datetime not null comment '结束时间', `gpu` int(10) not null comment '使用GPU数。来自gres_req字段', `cpus_req` int unsigned not null comment '申请CPU数tres_req', `mem_req` int unsigned not null comment '申请的内存，单位MB，来自tres_req', `nodes_req` int unsigned not null comment '申请节点数,tres_req', `cpus_alloc` int unsigned not null comment '分配CPU数tres_alloc', `mem_alloc` int unsigned not null comment '分配的内存，单位MB，来自tres_alloc', `nodes_alloc` int unsigned not null comment '分配节点数tres_alloc', `timelimit` int unsigned not null comment '作业时间限制', `time_used` bigint unsigned not null comment '作业执行时间', `time_wait` bigint unsigned not null comment '作业等待时间', `qos` varchar(255) not null comment 'QOS', `record_time` timestamp not null default CURRENT_TIMESTAMP comment '记录时间', `tenant` varchar(255) not null, `account_billing_item_id` varchar(255) not null default 'UNKNOWN', `tenant_billing_item_id` varchar(255) not null default 'UNKNOWN', `tenant_price` DECIMAL(19,4) not null default 0.0000, `account_price` DECIMAL(19,4) not null default 0.0000) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `job_info` add index `idJob`(`id_job`);");
    this.addSql("alter table `job_info` add index `account`(`account`);");
    this.addSql("alter table `job_info` add index `user`(`user`);");
    this.addSql("alter table `job_info` add index `time_submit`(`time_submit`);");
    this.addSql("alter table `job_info` add index `time_start`(`time_start`);");
    this.addSql("alter table `job_info` add index `time_end`(`time_end`);");
    this.addSql("alter table `job_info` add index `time_used`(`time_used`);");
    this.addSql("alter table `job_info` add index `time_wait`(`time_wait`);");
    this.addSql("alter table `job_info` add index `record_time`(`record_time`);");

    this.addSql(
      "create table `tenant` (`id` int unsigned not null auto_increment primary key, `name` varchar(255) not null, `balance` DECIMAL(19,4) not null default 0.0000) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `tenant` add unique `tenant_name_unique`(`name`);");

    this.addSql(
      "create table `job_billing_item` (`id` int unsigned not null auto_increment primary key, `item_id` varchar(255) not null, `path` text not null comment '集群,分区[,qos]', `description` varchar(255) not null, `tenant_id` int(11) unsigned null, `price` DECIMAL(19,4) not null, `create_time` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `job_billing_item` add unique `job_billing_item_item_id_unique`(`item_id`);");
    this.addSql("alter table `job_billing_item` add index `job_billing_item_tenant_id_index`(`tenant_id`);");

    this.addSql(
      "create table `user` (`id` int unsigned not null auto_increment primary key, `tenant_id` int(11) unsigned not null, `user_id` varchar(255) not null, `name` varchar(255) not null, `email` varchar(255) not null, `create_time` DATETIME(6) not null default CURRENT_TIMESTAMP(6), `tenant_roles` text not null comment 'TENANT_FINANCE, TENANT_ADMIN', `platform_roles` text not null comment 'PLATFORM_FINANCE, PLATFORM_ADMIN') default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `user` add index `user_tenant_id_index`(`tenant_id`);");
    this.addSql("alter table `user` add unique `user_user_id_unique`(`user_id`);");

    this.addSql(
      "create table `storage_quota` (`id` int unsigned not null auto_increment primary key, `user_id` int(11) unsigned not null, `cluster` varchar(255) not null, `storage_quota` int not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `storage_quota` add index `storage_quota_user_id_index`(`user_id`);");

    this.addSql(
      "create table `account_whitelist` (`id` int unsigned not null auto_increment primary key, `time` datetime not null, `comment` varchar(255) not null, `operator_id` varchar(255) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `account` (`id` int unsigned not null auto_increment primary key, `account_name` varchar(255) not null, `tenant_id` int(11) unsigned not null, `blocked` tinyint(1) not null, `whitelist_id` int(11) unsigned null, `comment` varchar(255) not null default '', `balance` DECIMAL(19,4) not null default 0.0000) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `account` add unique `account_account_name_unique`(`account_name`);");
    this.addSql("alter table `account` add index `account_tenant_id_index`(`tenant_id`);");
    this.addSql("alter table `account` add index `account_whitelist_id_index`(`whitelist_id`);");
    this.addSql("alter table `account` add unique `account_whitelist_id_unique`(`whitelist_id`);");

    this.addSql(
      "create table `user_account` (`id` int unsigned not null auto_increment primary key, `user_id` int(11) unsigned not null, `account_id` int(11) unsigned not null, `status` varchar(10) not null comment 'UNBLOCKED, BLOCKED', `role` varchar(10) not null comment 'USER, ADMIN, OWNER', `used_job_charge` DECIMAL(19,4) null, `job_charge_limit` DECIMAL(19,4) null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `user_account` add index `user_account_user_id_index`(`user_id`);");
    this.addSql("alter table `user_account` add index `user_account_account_id_index`(`account_id`);");

    this.addSql(
      "alter table `job_billing_item` add constraint `job_billing_item_tenant_id_foreign` foreign key (`tenant_id`) references `tenant` (`id`) on update cascade on delete set null;",
    );

    this.addSql(
      "alter table `user` add constraint `user_tenant_id_foreign` foreign key (`tenant_id`) references `tenant` (`id`) on update cascade;",
    );

    this.addSql(
      "alter table `storage_quota` add constraint `storage_quota_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade on delete CASCADE;",
    );

    this.addSql(
      "alter table `account` add constraint `account_tenant_id_foreign` foreign key (`tenant_id`) references `tenant` (`id`) on update cascade;",
    );
    this.addSql(
      "alter table `account` add constraint `account_whitelist_id_foreign` foreign key (`whitelist_id`) references `account_whitelist` (`id`) on update cascade on delete set null;",
    );

    this.addSql(
      "alter table `user_account` add constraint `user_account_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade on delete CASCADE;",
    );
    this.addSql(
      "alter table `user_account` add constraint `user_account_account_id_foreign` foreign key (`account_id`) references `account` (`id`) on update cascade on delete CASCADE;",
    );
  }
}
