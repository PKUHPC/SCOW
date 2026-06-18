import { Migration } from '@mikro-orm/migrations';

export class Migration20260428062609 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`ai_job_submit_record\` (\`id\` int unsigned not null auto_increment primary key, \`user_id\` varchar(255) not null, \`job_type\` enum('app', 'train', 'infer', 'dev_host') not null, \`job_id\` int not null, \`app_id\` varchar(255) null, \`cluster\` varchar(255) not null, \`account\` varchar(255) not null, \`form_data\` json not null, \`created_at\` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`ai_job_submit_record\` add unique \`uk_user_cluster_job_id\`(\`user_id\`, \`cluster\`, \`job_id\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`ai_job_submit_record\`;`);
  }

}
