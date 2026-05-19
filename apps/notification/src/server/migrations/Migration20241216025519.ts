import { Migration } from "@mikro-orm/migrations";

export class Migration20241216025519 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `user_message_read` add unique `uniq_user_message`(`user_id`, `message_id`);");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `user_message_read` drop index `uniq_user_message`;");
  }
}
