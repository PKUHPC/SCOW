import { Migration } from "@mikro-orm/migrations";
/* eslint-disable @stylistic/max-len */
export class Migration20250417101050 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "create table `account_user_sync_record` (`id` int unsigned not null auto_increment primary key, `session_id` varchar(50) not null, `sync_operator_id` varchar(255) null, `start_time` DATETIME(6) not null default current_timestamp(6), `update_time` DATETIME(6) null, `sync_status` enum('COMPLETED', 'RUNNING', 'UNEXECUTED') not null default 'RUNNING' comment 'COMPLETED, RUNNING, UNEXECUTED', `sync_result` enum('SUCCESS', 'FAILED') null comment 'SUCCESS, FAILED', `sync_details` json null, `max_sync_duration_minutes` int not null) default character set utf8mb4 engine = InnoDB;",
    );
    this.addSql("alter table `account_user_sync_record` add index `start_time`(`start_time`);");
  }

  override async down(): Promise<void> {
    this.addSql("drop table if exists `account_user_sync_record`;");
  }
}
