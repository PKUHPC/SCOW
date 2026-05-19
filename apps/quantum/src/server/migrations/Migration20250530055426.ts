/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20250530055426 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `quantum_job` (`id` int unsigned not null auto_increment primary key, `job_id` varchar(255) not null, `submit_time` datetime not null, `state` varchar(255) not null, `info` json not null, `user_id` varchar(255) not null, `last_sync_time` datetime not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `quantum_job` add index `quantum_job_job_id_index`(`job_id`);");
    this.addSql("alter table `quantum_job` add index `quantum_job_state_index`(`state`);");
    this.addSql("alter table `quantum_job` add index `quantum_job_user_id_index`(`user_id`);");
    this.addSql("alter table `quantum_job` add index `quantum_job_last_sync_time_index`(`last_sync_time`);");

    this.addSql(
      "create table `user_token` (`id` int unsigned not null auto_increment primary key, `user_id` varchar(255) not null, `token` varchar(255) not null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `user_token` add unique `user_token_user_id_unique`(`user_id`);");
    this.addSql("alter table `user_token` add index `user_token_token_index`(`token`);");
  }

  override async down(): Promise<void> {
    this.addSql("drop table if exists `quantum_job`;");

    this.addSql("drop table if exists `user_token`;");
  }
}
