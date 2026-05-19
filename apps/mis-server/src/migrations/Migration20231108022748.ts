/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20231108022748 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `query_cache` (`id` int unsigned not null auto_increment primary key, `query_key` varchar(255) not null, `query_result` json not null, `timestamp` DATETIME(6) not null) default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql("alter table `charge_record` add index `static_info`(`time`, `account_name`, `amount`);");

    this.addSql("alter table `pay_record` add index `static_info`(`time`, `account_name`, `amount`);");

    this.addSql("alter table `account` add `create_time` DATETIME(6) null;");
  }

  async down(): Promise<void> {
    this.addSql("drop table if exists `query_cache`;");

    this.addSql("alter table `charge_record` drop index `static_info`;");

    this.addSql("alter table `pay_record` drop index `static_info`;");

    this.addSql("alter table `account` drop `create_time`;");
  }
}
