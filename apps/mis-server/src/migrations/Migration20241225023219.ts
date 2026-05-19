import { Migration } from "@mikro-orm/migrations";

export class Migration20241225023219 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `job_info` modify `time_start` datetime null comment '开始时间';");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `job_info` modify `time_start` datetime not null comment '开始时间';");
  }
}
