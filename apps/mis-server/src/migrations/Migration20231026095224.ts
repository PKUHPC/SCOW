import { Migration } from "@mikro-orm/migrations";

export class Migration20231026095224 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `charge_record` add index `query_info`(`time`, `tenant_name`, `account_name`, `type`);");
  }

  async down(): Promise<void> {
    this.addSql("alter table `charge_record` drop index `query_info`;");
  }
}
