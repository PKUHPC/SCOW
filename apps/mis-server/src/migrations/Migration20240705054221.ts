import { Migration } from "@mikro-orm/migrations";

export class Migration20240705054221 extends Migration {
  async up(): Promise<void> {
    // 修改已经存在的 `state` 列以增加新枚举值 'DELETED'
    this.addSql(
      "alter table `account` modify `state` enum('NORMAL', 'FROZEN', 'BLOCKED_BY_ADMIN', 'DELETED') " +
        "not null default 'NORMAL' comment 'NORMAL, FROZEN, BLOCKED_BY_ADMIN, DELETED';",
    );

    // 如果 `user` 表中还没有 `state` 列，添加它
    this.addSql(
      "alter table `user` add `state` enum('NORMAL', 'DELETED') " +
        "not null default 'NORMAL' comment 'NORMAL, DELETED';",
    );

    // 添加 `deletion_comment` 列到 `user` 表
    this.addSql("alter table `user` add `deletion_comment` varchar(255) null;");
  }

  async down(): Promise<void> {
    // 恢复 `account` 表中 `state` 列的原始枚举值
    this.addSql(
      "alter table `account` modify `state` enum('NORMAL', 'FROZEN', 'BLOCKED_BY_ADMIN') " +
        "not null default 'NORMAL' comment 'NORMAL, FROZEN, BLOCKED_BY_ADMIN';",
    );

    // 删除 `user` 表中的 `state` 列
    this.addSql("alter table `user` drop column `state`;");

    // 删除 `deletion_comment` 列
    this.addSql("alter table `user` drop column `deletion_comment`;");
  }
}
