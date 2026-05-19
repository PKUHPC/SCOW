import { Migration } from "@mikro-orm/migrations";

export class Migration20240103024536 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `image` change `tags` `tag` varchar(255) not null;");
  }

  async down(): Promise<void> {
    this.addSql("alter table `image` change `tag` `tags` varchar(255) not null;");
  }
}
