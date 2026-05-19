import { Migration } from "@mikro-orm/migrations";

export class Migration20240126070152 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `image` add `status` enum('CREATED', 'CREATING', 'FAILURE') not null;");
    this.addSql("alter table `image` modify `path` varchar(255) null;");
    this.addSql("alter table `image` add unique `unique_name_tag_owner`(`name`, `tag`, `owner`);");
  }

  async down(): Promise<void> {
    this.addSql("alter table `image` modify `path` varchar(255) not null;");
    this.addSql("alter table `image` drop index `unique_name_tag_owner`;");
    this.addSql("alter table `image` drop `status`;");
  }
}
