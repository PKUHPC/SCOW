/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20251107023205 extends Migration {

  override async up(): Promise<void> {
    this.addSql("alter table `account_bill` modify `account_owner_id` varchar(255) null comment '账户拥有者id', modify `account_owner_name` varchar(255) null comment '账户拥有者姓名';");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `account_bill` modify `account_owner_id` varchar(255) not null comment '账户拥有者id', modify `account_owner_name` varchar(255) not null comment '账户拥有者姓名';");
  }

}
