/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20240313015230 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `operation_log` add `custom_event_type` varchar(255) null;");
    this.addSql(
      "alter table `operation_log` modify `operation_time` DATETIME(6) not null default current_timestamp(6), modify `operation_result` enum('UNKNOWN', 'SUCCESS', 'FAIL') not null comment 'UNKNOWN, SUCCESS, FAIL';",
    );
    this.addSql("alter table `operation_log` add index `custom_event`(`custom_event_type`);");
  }

  async down(): Promise<void> {
    this.addSql("alter table `operation_log` drop index `custom_event`;");
    this.addSql("alter table `operation_log` drop column `custom_event_type`;");

    this.addSql(
      "alter table `operation_log` modify `operation_time` DATETIME(6) not null default current_timestamp(0), modify `operation_result` enum('UNKNOWN', 'SUCCESS', 'FAIL') not null comment 'UNKNOWN, SUCCESS, FAIL';",
    );
  }
}
