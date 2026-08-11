import { Migration } from "@mikro-orm/migrations";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { logger } from "src/utils/logger";

export class Migration20260721031740 extends Migration {
  // 创建字段时同步迁移历史授权数据：AI 已启用的集群按 AI 回填，其余集群按 HPC 回填。
  override async up(): Promise<void> {
    const clusterConfigs = getClusterConfigs(undefined, logger);
    const aiClusterIds = Object.entries(clusterConfigs)
      .filter(([, config]) => config.ai.enabled)
      .map(([clusterId]) => clusterId);
    const tables = ["account_app_blacklist", "tenant_app_blacklist", "tenant_default_app_removed_list"];

    // 先添加 nullable 字段，避免历史记录在回填完成前违反非空约束。
    for (const table of tables) {
      this.addSql(
        `alter table \`${table}\` add \`app_scope\` enum('HPC', 'AI') null comment 'HPC, AI' after \`app_id\`;`,
      );
      // 未开启 AI 的集群沿用原有 HPC 应用语义；AI 集群在下一步覆盖。
      this.addSql(`update \`${table}\` set \`app_scope\` = 'HPC' where \`app_scope\` is null;`);

      for (const clusterId of aiClusterIds) {
        // 使用 Knex 参数转义配置中的集群 ID，避免直接拼接外部字符串。
        const escapedClusterId = this.getKnex().raw("?", [clusterId]).toQuery();
        this.addSql(
          `update \`${table}\` as target inner join \`cluster\` as c on c.\`id\` = target.\`cluster_id\` ` +
            `set target.\`app_scope\` = 'AI' where c.\`cluster_id\` = ${escapedClusterId};`,
        );
      }
    }

    // 同一新业务键的历史重复记录只保留最小 id，保证后续唯一索引可以创建。
    this.addSql(
      "delete duplicate from `account_app_blacklist` as duplicate " +
        "inner join `account_app_blacklist` as retained " +
        "on duplicate.`cluster_id` = retained.`cluster_id` " +
        "and duplicate.`account_id` = retained.`account_id` " +
        "and duplicate.`app_scope` = retained.`app_scope` " +
        "and duplicate.`app_id` = retained.`app_id` " +
        "and duplicate.`id` > retained.`id`;",
    );
    this.addSql(
      "delete duplicate from `tenant_app_blacklist` as duplicate " +
        "inner join `tenant_app_blacklist` as retained " +
        "on duplicate.`cluster_id` = retained.`cluster_id` " +
        "and duplicate.`tenant_id` = retained.`tenant_id` " +
        "and duplicate.`app_scope` = retained.`app_scope` " +
        "and duplicate.`app_id` = retained.`app_id` " +
        "and duplicate.`id` > retained.`id`;",
    );
    this.addSql(
      "delete duplicate from `tenant_default_app_removed_list` as duplicate " +
        "inner join `tenant_default_app_removed_list` as retained " +
        "on duplicate.`cluster_id` = retained.`cluster_id` " +
        "and duplicate.`tenant_id` = retained.`tenant_id` " +
        "and duplicate.`app_scope` = retained.`app_scope` " +
        "and duplicate.`app_id` = retained.`app_id` " +
        "and duplicate.`id` > retained.`id`;",
    );

    // 历史数据已经全部回填后再收紧非空约束。
    for (const table of tables) {
      this.addSql(`alter table \`${table}\` modify \`app_scope\` enum('HPC', 'AI') not null comment 'HPC, AI';`);
    }

    // 普通索引用于按集群、scope、appId 查询禁用账户；唯一索引用于保证写入幂等。
    this.addSql("alter table `account_app_blacklist` drop index `idx_cluster_account_app`;");
    this.addSql(
      "alter table `account_app_blacklist` add index `idx_cluster_scope_app`" +
        "(`cluster_id`, `app_scope`, `app_id`);",
    );
    this.addSql(
      "alter table `account_app_blacklist` add unique `uk_cluster_account_scope_app`" +
        "(`cluster_id`, `account_id`, `app_scope`, `app_id`);",
    );
    this.addSql(
      "alter table `tenant_app_blacklist` add unique `uk_cluster_tenant_scope_app`" +
        "(`cluster_id`, `tenant_id`, `app_scope`, `app_id`);",
    );
    this.addSql(
      "alter table `tenant_default_app_removed_list` add unique `uk_cluster_tenant_scope_app`" +
        "(`cluster_id`, `tenant_id`, `app_scope`, `app_id`);",
    );
  }

  override async down(): Promise<void> {
    // 回滚会移除 appScope 及其索引；up() 中删除的历史重复记录不会恢复。
    this.addSql(`alter table \`tenant_default_app_removed_list\` drop index \`uk_cluster_tenant_scope_app\`;`);
    this.addSql(`alter table \`tenant_default_app_removed_list\` drop column \`app_scope\`;`);

    this.addSql(`alter table \`tenant_app_blacklist\` drop index \`uk_cluster_tenant_scope_app\`;`);
    this.addSql(`alter table \`tenant_app_blacklist\` drop column \`app_scope\`;`);

    this.addSql(`alter table \`account_app_blacklist\` drop index \`idx_cluster_scope_app\`;`);
    this.addSql(`alter table \`account_app_blacklist\` drop index \`uk_cluster_account_scope_app\`;`);
    this.addSql(`alter table \`account_app_blacklist\` drop column \`app_scope\`;`);

    this.addSql(
      `alter table \`account_app_blacklist\` add index \`idx_cluster_account_app\`(\`cluster_id\`, \`account_id\`, \`app_id\`);`,
    );
  }
}
