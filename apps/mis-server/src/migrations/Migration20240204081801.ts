import { Migration } from "@mikro-orm/migrations";

export class Migration20240204081801 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `tenant` add `default_account_block_threshold` DECIMAL(19,4) not null default 0.0000;");

    this.addSql("alter table `account` add `block_threshold_amount` DECIMAL(19,4) null;");
  }

  async down(): Promise<void> {
    this.addSql("alter table `tenant` drop column `default_account_block_threshold`;");

    this.addSql("alter table `account` drop column `block_threshold_amount`;");
  }
}
