/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20241014145518 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `account_bill` (`id` int unsigned not null auto_increment primary key, `tenant_name` varchar(255) not null comment '所属租户', `account_name` varchar(255) not null comment '所属账户', `account_owner_id` varchar(255) not null comment '账户主管理员id', `account_owner_name` varchar(255) not null comment '账户主管理员姓名', `term` varchar(255) not null comment '账期，如202407、2024', `amount` DECIMAL(19,4) not null, `type` varchar(255) not null comment '账单类型，年度账单或月度账单', `create_time` DATETIME(6) null, `update_time` DATETIME(6) null, `details` json null comment '账单详情，因为扣费类型不确定，此处用JSON展示，便于拓展') default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "create table `user_bill` (`id` int unsigned not null auto_increment primary key, `tenant_name` varchar(255) not null comment '所属租户', `account_name` varchar(255) not null comment '所属账户', `user_id` varchar(255) not null comment '用户id', `name` varchar(255) not null comment '用户姓名', `term` varchar(255) not null comment '账期，如202407、2024', `amount` DECIMAL(19,4) not null, `type` varchar(255) not null comment '账单类型，年度账单或月度账单', `create_time` DATETIME(6) null, `account_bill_id` int unsigned not null, `details` json not null comment '账单详情，因为扣费类型不确定，此处用JSON展示，便于拓展') default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `user_bill` add index `user_bill_account_bill_id_index`(`account_bill_id`);");

    this.addSql(
      "alter table `user_bill` add constraint `user_bill_account_bill_id_foreign` foreign key (`account_bill_id`) references `account_bill` (`id`) on update cascade on delete cascade;",
    );
  }

  async down(): Promise<void> {
    this.addSql("alter table `user_bill` drop foreign key `user_bill_account_bill_id_foreign`;");

    this.addSql("drop table if exists `account_bill`;");

    this.addSql("drop table if exists `user_bill`;");
  }
}
