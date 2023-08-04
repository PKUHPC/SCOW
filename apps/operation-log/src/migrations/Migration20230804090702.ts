import { Migration } from '@mikro-orm/migrations';

export class Migration20230804090702 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `operation_log` (`id` int unsigned not null auto_increment primary key, `operator_user_id` varchar(255) not null, `operator_ip` varchar(255) not null, `operation_time` datetime not null default current_timestamp(0), `operation_result` int not null, `meta_data` varchar(255) not null) default character set utf8mb4 engine = InnoDB;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists `operation_log`;');
  }

}
