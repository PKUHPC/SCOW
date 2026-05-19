import { Migration } from "@mikro-orm/migrations";

export class Migration20240129075557 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `tenant` modify `create_time` DATETIME(6) not null default current_timestamp(6);");

    this.addSql("alter table `user` modify `create_time` DATETIME(6) not null default current_timestamp(6);");
  }

  async down(): Promise<void> {
    this.addSql("alter table `tenant` modify `create_time` DATETIME(6) not null default current_timestamp(0);");

    this.addSql("alter table `user` modify `create_time` DATETIME(6) not null default current_timestamp(0);");
  }
}
