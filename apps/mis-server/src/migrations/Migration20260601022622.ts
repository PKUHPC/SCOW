import { Migration } from '@mikro-orm/migrations';

export class Migration20260601022622 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`app_template\` (\`id\` int unsigned not null auto_increment primary key, \`user_id\` varchar(255) not null, \`cluster\` varchar(50) not null, \`template_name\` varchar(100) not null, \`account\` varchar(255) not null, \`partition\` varchar(255) not null, \`qos\` varchar(255) not null, \`node_count\` int not null, \`core_count\` int not null, \`gpu_count\` int not null, \`max_time\` int not null comment '最大运行时间（原始值）', \`max_time_unit\` enum('MINUTE', 'HOUR', 'DAY') not null default 'MINUTE' comment 'MINUTE, HOUR, DAY', \`memory_mb\` int null comment '内存（MB）', \`app_id\` varchar(50) not null, \`custom_attributes\` json null, \`created_at\` DATETIME(6) not null default current_timestamp(6), \`updated_at\` DATETIME(6) null) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`app_template\` add index \`idx_list_app_template\`(\`user_id\`, \`cluster\`, \`app_id\`);`);
    this.addSql(`alter table \`app_template\` add unique \`uk_user_app_template_cluster\`(\`user_id\`, \`template_name\`, \`cluster\`, \`app_id\`);`);

    this.addSql(`create table \`job_template\` (\`id\` int unsigned not null auto_increment primary key, \`user_id\` varchar(255) not null, \`cluster\` varchar(255) not null, \`template_name\` varchar(255) not null, \`account\` varchar(255) not null, \`partition\` varchar(255) not null, \`qos\` varchar(255) not null, \`node_count\` int not null, \`core_count\` int not null, \`gpu_count\` int not null, \`max_time\` int not null comment '最大运行时间（原始值）', \`max_time_unit\` enum('MINUTE', 'HOUR', 'DAY') not null default 'MINUTE' comment 'MINUTE, HOUR, DAY', \`memory_mb\` int null comment '内存（MB）', \`command\` text null, \`created_at\` DATETIME(6) not null default current_timestamp(6), \`updated_at\` DATETIME(6) null) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`job_template\` add unique \`uk_user_job_template_name\`(\`user_id\`, \`template_name\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`app_template\`;`);

    this.addSql(`drop table if exists \`job_template\`;`);
  }

}
