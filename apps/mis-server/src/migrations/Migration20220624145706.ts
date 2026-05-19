/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20220624145706 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `system_state` (`key` varchar(255) not null, `value` varchar(255) not null, primary key (`key`)) default character set utf8mb4 engine = InnoDB;",
    );
  }

  async down(): Promise<void> {
    this.addSql("drop table if exists `system_state`;");
  }
}
