
import { Migration } from "@mikro-orm/migrations";

export class Migration20250918092121 extends Migration {

  override async up(): Promise<void> {
    this.addSql("alter table `account_user_sync_record` add index `sync_status`(`sync_status`);");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `account_user_sync_record` drop index `sync_status`;");
  }

}
