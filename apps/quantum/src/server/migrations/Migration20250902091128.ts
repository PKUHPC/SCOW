import { Migration } from "@mikro-orm/migrations";

export class Migration20250902091128 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `quantum_job` add `amount` DECIMAL(19,4) null;");
    this.addSql("alter table `quantum_job` add index `quantum_job_amount_index`(`amount`);");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `quantum_job` drop index `quantum_job_amount_index`;");
    this.addSql("alter table `quantum_job` drop column `amount`;");
  }
}
