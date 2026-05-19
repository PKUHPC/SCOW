import { Migration } from "@mikro-orm/migrations";

export class Migration20241227021546 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `image` add `tag_postfix` varchar(255) null;");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `image` drop column `tag_postfix`;");
  }
}
