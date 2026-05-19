import { Migration } from "@mikro-orm/migrations";

export class Migration20250217064353 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `messages` add index `messages_message_type_index`(`message_type`);");
    this.addSql("alter table `messages` add index `messages_expired_at_index`(`expired_at`);");
    this.addSql("alter table `messages` add index `messages_created_at_index`(`created_at`);");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `messages` drop index `messages_message_type_index`;");
    this.addSql("alter table `messages` drop index `messages_expired_at_index`;");
    this.addSql("alter table `messages` drop index `messages_created_at_index`;");
  }
}
