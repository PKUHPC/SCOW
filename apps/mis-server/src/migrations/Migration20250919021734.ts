/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";

export class Migration20250919021734 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "alter table `tenant_user_storage_quota` add `usage` bigint not null comment '租户下用户的存储使用量';",
    );
    this.addSql(
      "alter table `tenant_user_storage_quota` modify `storage_quota` bigint null comment '租户下用户的存储配额';",
    );
    this.addSql(
      "alter table `tenant_user_storage_quota` add unique `tenant_user_storage_quota_cluster_user_id_path_unique`(`cluster`, `user_id`, `path`);",
    );
  }

  override async down(): Promise<void> {
    this.addSql("alter table `tenant_user_storage_quota` drop column `usage`;");
    this.addSql(
      "alter table `tenant_user_storage_quota` modify `storage_quota` bigint not null comment '租户下用户的存储配额';",
    );
    this.addSql(
      "alter table `tenant_user_storage_quota` drop index `tenant_user_storage_quota_cluster_user_id_path_unique`;",
    );
  }
}
