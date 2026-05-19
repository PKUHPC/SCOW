import { Migration } from "@mikro-orm/migrations";

export class Migration20250819030518 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `image` add `failed_reason` TEXT null;");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `image` drop column `failed_reason`;");
  }
}
