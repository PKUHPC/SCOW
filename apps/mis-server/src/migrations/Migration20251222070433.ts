/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20251222070433 extends Migration {

  override async up(): Promise<void> {
    this.addSql("create table `running_job_charge_record` (`id` int unsigned not null auto_increment primary key, `cluster` varchar(255) not null comment '集群ID', `job_id` int not null comment '作业ID', `start_time` DATETIME(6) not null comment '开始时间', `tenant_billing_item_id` varchar(255) not null default 'UNKNOWN' comment '平台计费项ID', `account_billing_item_id` varchar(255) not null default 'UNKNOWN' comment '租户计费项ID', `tenant_price` DECIMAL(19,4) not null default 0.0000, `account_price` DECIMAL(19,4) not null default 0.0000, `last_charge_time` DATETIME(6) not null comment '上一次计费时间') default character set utf8mb4 engine = InnoDB;");
    this.addSql("alter table `running_job_charge_record` add index `query`(`cluster`, `job_id`);");
  }

  override async down(): Promise<void> {
    this.addSql("drop table if exists `running_job_charge_record`;");
  }

}
