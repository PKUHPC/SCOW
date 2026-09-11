import { Migration } from "@mikro-orm/migrations";

export class Migration20260514085627 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table \`storage_price_item\` (\`id\` int unsigned not null auto_increment primary key, \`storage_id\` varchar(255) not null, \`billing_mode\` enum('usage', 'quota') not null, \`tiers\` json not null, \`original_tiers\` json null, \`tenant_id\` int unsigned null, \`create_time\` DATETIME(6) not null, \`description\` varchar(255) not null default '') default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(`alter table \`storage_price_item\` add index \`storage_price_item_tenant_id_index\`(\`tenant_id\`);`);

    this.addSql(
      `create table \`daily_storage_usage\` (\`id\` int unsigned not null auto_increment primary key, \`user_id\` varchar(255) null comment '用户 ID', \`account_name\` varchar(255) null comment '账户名称', \`cluster\` varchar(255) not null, \`storage_id\` varchar(255) not null comment '文件系统 storageId', \`date\` varchar(255) not null comment '日期（东八区 YYYY-MM-DD）', \`usages\` json not null comment '当天各次采样用量(GB)，保留2位小数', \`average_usage\` int null comment '日均用量(GB)，进一法取整') default character set utf8mb4 engine = InnoDB;`,
    );
    this.addSql(`alter table \`daily_storage_usage\` add index \`daily_storage_usage_user_id_index\`(\`user_id\`);`);
    this.addSql(
      `alter table \`daily_storage_usage\` add index \`daily_storage_usage_account_name_index\`(\`account_name\`);`,
    );
    this.addSql(
      `alter table \`daily_storage_usage\` add index \`idx_daily_storage_usage_storage_id\`(\`storage_id\`);`,
    );
    this.addSql(
      `alter table \`daily_storage_usage\` add index \`daily_storage_usage_storage_id_date_index\`(\`storage_id\`, \`date\`);`,
    );
    this.addSql(
      `alter table \`daily_storage_usage\` add unique \`daily_storage_usage_user_id_storage_id_date_unique\`(\`user_id\`, \`storage_id\`, \`date\`);`,
    );
    this.addSql(
      `alter table \`daily_storage_usage\` add unique \`daily_storage_usage_account_name_storage_id_date_unique\`(\`account_name\`, \`storage_id\`, \`date\`);`,
    );

    this.addSql(
      `alter table \`storage_price_item\` add constraint \`storage_price_item_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenant\` (\`id\`) on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table \`account_storage_quota\` add \`usage\` bigint not null comment '租户下账户的存储使用量（MB）';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`storage_price_item\`;`);

    this.addSql(`drop table if exists \`daily_storage_usage\`;`);

    this.addSql(`alter table \`account_storage_quota\` drop column \`usage\`;`);
  }
}
