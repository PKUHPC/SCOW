import { Migration } from "@mikro-orm/migrations";

export class Migration20260330000001 extends Migration {

  override async up(): Promise<void> {
    // 创建账户存储配额表
    this.addSql(
      "create table `account_storage_quota` (" +
      "`id` int unsigned not null auto_increment primary key, " +
      "`account_id` int unsigned not null, " +
      "`storage_id` varchar(255) not null comment '文件系统 storageId', " +
      "`storage_quota_mb` bigint null comment '账户存储配额，单位 MB，null 表示不限制'" +
      ") default character set utf8mb4 engine = InnoDB;",
    );

    this.addSql(
      "alter table `account_storage_quota` " +
      "add constraint `account_storage_quota_account_id_foreign` foreign key (`account_id`) " +
      "references `account` (`id`) on delete cascade;",
    );

    this.addSql(
      "alter table `account_storage_quota` " +
      "add index `idx_storage_id`(`storage_id`);",
    );

    this.addSql(
      "alter table `account_storage_quota` " +
      "add unique `account_storage_quota_account_id_storage_id_unique`(`account_id`, `storage_id`);",
    );

    // 在账户存储配额表中添加租户默认配额字段
    this.addSql(
      "alter table `tenant_storage_quota` " +
      "add column `account_default_quota` bigint null comment '租户下账户默认的存储配额，单位 MB，null 表示使用文件系统总量';",
    );
  }

  override async down(): Promise<void> {
    this.addSql("alter table `tenant_storage_quota` drop column `account_default_quota`;");
    this.addSql("drop table if exists `account_storage_quota`;");
  }

}
