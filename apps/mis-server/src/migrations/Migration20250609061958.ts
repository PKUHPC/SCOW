/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20250609061958 extends Migration {

  override async up(): Promise<void> {
    this.addSql("create table `tenant_storage_quota` (`id` int unsigned not null auto_increment primary key, `tenant_id` int unsigned not null, `cluster` varchar(255) not null, `path` varchar(255) not null comment '存储挂载目录', `user_default_quota` bigint not null comment '租户下用户默认的存储配额') default character set utf8mb4 engine = InnoDB;");
    this.addSql("alter table `tenant_storage_quota` add index `tenant_storage_quota_tenant_id_index`(`tenant_id`);");
    this.addSql("alter table `tenant_storage_quota` add index `idx_cluster`(`cluster`);");
    this.addSql("alter table `tenant_storage_quota` add index `idx_path`(`path`);");

    this.addSql("create table `tenant_user_storage_quota` (`id` int unsigned not null auto_increment primary key, `user_id` int unsigned not null, `cluster` varchar(255) not null, `path` varchar(255) not null comment '存储挂载目录', `storage_quota` bigint not null comment '租户下用户的存储配额') default character set utf8mb4 engine = InnoDB;");
    this.addSql("alter table `tenant_user_storage_quota` add index `tenant_user_storage_quota_user_id_index`(`user_id`);");
    this.addSql("alter table `tenant_user_storage_quota` add index `idx_cluster`(`cluster`);");
    this.addSql("alter table `tenant_user_storage_quota` add index `idx_path`(`path`);");

    this.addSql("alter table `tenant_storage_quota` add constraint `tenant_storage_quota_tenant_id_foreign` foreign key (`tenant_id`) references `tenant` (`id`) on update cascade on delete cascade;");

    this.addSql("alter table `tenant_user_storage_quota` add constraint `tenant_user_storage_quota_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade on delete cascade;");

    this.addSql("drop table if exists `storage_quota`;");
  }

  override async down(): Promise<void> {
    this.addSql("create table `storage_quota` (`id` int unsigned not null auto_increment primary key, `user_id` int unsigned not null, `cluster` varchar(255) not null, `storage_quota` int not null) default character set utf8mb4 engine = InnoDB;");
    this.addSql("alter table `storage_quota` add index `storage_quota_user_id_index`(`user_id`);");

    this.addSql("alter table `storage_quota` add constraint `storage_quota_user_id_foreign` foreign key (`user_id`) references `user` (`id`) on update cascade on delete cascade;");

    this.addSql("drop table if exists `tenant_storage_quota`;");

    this.addSql("drop table if exists `tenant_user_storage_quota`;");
  }

}
