import { Migration } from "@mikro-orm/migrations";

export class Migration20240103072610 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `dataset_version` add `shared_status` varchar(255) not null;");
    this.addSql("alter table `dataset_version` drop `is_shared`;");
  }

  async down(): Promise<void> {
    this.addSql("alter table `dataset_version` add `is_shared` tinyint(1) not null;");
    this.addSql("alter table `dataset_version` drop `shared_status`;");
  }
}
