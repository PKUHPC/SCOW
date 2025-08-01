import { Migration } from "@mikro-orm/migrations";

export class Migration20250725020521 extends Migration {

  override async up(): Promise<void> {
    this.addSql("alter table `quantum_job` add `tenant_name` varchar(255) not null,"
      + " add `account_name` varchar(255) not null;");
    this.addSql("alter table `quantum_job` add index `quantum_job_tenant_name_index`(`tenant_name`);");
    this.addSql("alter table `quantum_job` add index `quantum_job_account_name_index`(`account_name`);");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `quantum_job` drop index `quantum_job_tenant_name_index`;");
    this.addSql("alter table `quantum_job` drop index `quantum_job_account_name_index`;");
    this.addSql("alter table `quantum_job` drop column `tenant_name`, drop column `account_name`;");
  }

}
