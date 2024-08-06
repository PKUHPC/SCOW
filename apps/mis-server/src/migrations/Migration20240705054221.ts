/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Migration } from "@mikro-orm/migrations";

export class Migration20240705054221 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `alter table "account" modify "state" enum('NORMAL', 'FROZEN', 'BLOCKED_BY_ADMIN', 'DELETED')
      not null default 'NORMAL' comment 'NORMAL, FROZEN, BLOCKED_BY_ADMIN, DELETED';`,
    );

    this.addSql(
      `alter table "user" add "state" enum('NORMAL', 'DELETED')
      not null default 'NORMAL' comment 'NORMAL, DELETED', add "delete_remark" varchar(255) null;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `alter table "account" modify "state" enum('NORMAL', 'FROZEN', 'BLOCKED_BY_ADMIN')
      not null default 'NORMAL' comment 'NORMAL, FROZEN, BLOCKED_BY_ADMIN';`,
    );

    this.addSql(
      "alter table \"user\" drop column \"state\", drop column \"delete_remark\";",
    );
  }
}
