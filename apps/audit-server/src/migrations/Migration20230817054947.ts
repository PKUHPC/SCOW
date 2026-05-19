/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20230817054947 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `operation_log` (`id` int unsigned not null auto_increment primary key, `operator_user_id` varchar(255) not null, `operator_ip` varchar(255) not null, `operation_time` DATETIME(6) not null default current_timestamp(6), `operation_result` enum('UNKNOWN', 'SUCCESS', 'FAIL') not null comment 'UNKNOWN, SUCCESS, FAIL', `meta_data` json null) default character set utf8mb4 engine = InnoDB;",
    );
  }

  async down(): Promise<void> {
    this.addSql("drop table if exists `operation_log`;");
  }
}
