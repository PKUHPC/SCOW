import { Migration } from "@mikro-orm/migrations";

export class Migration20230116122732 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `tenant` add `create_time` DATETIME(6) not null default current_timestamp(6);");
  }

  async down(): Promise<void> {
    this.addSql("alter table `tenant` drop `create_time`;");
  }
}
