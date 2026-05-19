import { Migration } from "@mikro-orm/migrations";

export class Migration20240515090037 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `account_whitelist` add `expiration_time` datetime null;");
  }

  async down(): Promise<void> {
    this.addSql("alter table `account_whitelist` drop column `expiration_time`;");
  }
}
