/* eslint-disable @stylistic/max-len */

import { Migration } from "@mikro-orm/migrations";

export class Migration20230108135024 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `job_info` modify `account` varchar(255) not null comment '账户', modify `user` varchar(127) not null comment '用户名';",
    );
  }

  async down(): Promise<void> {
    this.addSql(
      "alter table `job_info` modify `account` varchar(20) not null comment '账户', modify `user` varchar(20) not null comment '用户名';",
    );
  }
}
