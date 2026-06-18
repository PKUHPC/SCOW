import { Migration } from '@mikro-orm/migrations';

export class Migration20260430070126 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`job_template\` (\`id\` int unsigned not null auto_increment primary key, \`user_id\` varchar(255) not null, \`job_type\` enum('app', 'train', 'infer', 'dev_host') not null, \`template_name\` varchar(255) not null, \`app_id\` varchar(255) not null default '', \`cluster\` varchar(255) not null, \`form_data\` json not null, \`created_at\` DATETIME(6) not null default current_timestamp(6), \`updated_at\` DATETIME(6) not null default current_timestamp(6)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`job_template\` add index \`idx_user_job_type_app\`(\`user_id\`, \`job_type\`, \`app_id\`);`);
    this.addSql(`alter table \`job_template\` add unique \`uk_user_template_name\`(\`user_id\`, \`template_name\`, \`job_type\`, \`app_id\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`job_template\`;`);
  }

}
