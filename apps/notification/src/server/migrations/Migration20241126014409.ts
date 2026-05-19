import { Migration } from "@mikro-orm/migrations";

export class Migration20241126014409 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `message_targets` add index `target_type_target_id_idx`(`target_type`, `target_id`);");

    this.addSql("alter table `user_message_read` modify `is_deleted` tinyint(1) not null default false;");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `message_targets` drop index `target_type_target_id_idx`;");

    this.addSql("alter table `user_message_read` modify `is_deleted` tinyint(1) not null;");
  }
}
