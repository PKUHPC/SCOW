/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20241118114016 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "alter table `user` add `phone` varchar(20) null, add `admin_comment` text null, add `organization` text null, add `metadata` json null;",
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      "alter table `user` drop column `phone`, drop column `admin_comment`, drop column `organization`, drop column `metadata`;",
    );
  }
}
