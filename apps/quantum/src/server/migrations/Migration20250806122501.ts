import { Migration } from "@mikro-orm/migrations";

export class Migration20250806122501 extends Migration {

  override async up(): Promise<void> {
    this.addSql("alter table `quantum_job` add `qits` DECIMAL(19,4) null;");
    this.addSql("alter table `quantum_job` add index `quantum_job_qits_index`(`qits`);");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `quantum_job` drop index `quantum_job_qits_index`;");
    this.addSql("alter table `quantum_job` drop column `qits`;");
  }

}
