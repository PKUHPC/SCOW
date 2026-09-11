/* eslint-disable @stylistic/max-len */
import { Migration } from "@mikro-orm/migrations";
import { getClusterConfigs } from "@scow/config/build/cluster";

const escapeSqlString = (value: string) => value.replaceAll("'", "''");

export class Migration20260318022254 extends Migration {
  override async up(): Promise<void> {
    // 1. 添加可空的 storage_id 列及索引
    await this.execute(
      `alter table \`tenant_storage_quota\` add \`storage_id\` varchar(255) null comment '文件系统 storageId';`,
    );
    await this.execute(
      `alter table \`tenant_storage_quota\` add index \`idx_storage_id\`(\`storage_id\`);`,
    );
    await this.execute(
      `alter table \`tenant_user_storage_quota\` add \`storage_id\` varchar(255) null comment '文件系统 storageId';`,
    );
    await this.execute(
      `alter table \`tenant_user_storage_quota\` add index \`idx_storage_id\`(\`storage_id\`);`,
    );

    // 2. 回填数据：根据当前集群配置，将 cluster + mountPath 映射到 storageId
    //    如果同一 cluster + mountPath 对应了多个 storageId，说明配置有歧义，直接中断迁移
    const clusterConfigs = getClusterConfigs(undefined, console);

    const clusterPathToStorageId = new Map<string, string>();
    for (const [clusterId, clusterConfig] of Object.entries(clusterConfigs)) {
      for (const entry of clusterConfig.entryPaths ?? []) {
        const mappingKey = `${clusterId}::${entry.mountPath}`;
        const existingStorageId = clusterPathToStorageId.get(mappingKey);

        if (existingStorageId && existingStorageId !== entry.storageId) {
          throw new Error(
            `Duplicate storage mapping for ${clusterId}/${entry.mountPath}: ` +
              `${existingStorageId} vs ${entry.storageId}`,
          );
        }

        clusterPathToStorageId.set(mappingKey, entry.storageId);
      }
    }

    for (const [mappingKey, storageId] of clusterPathToStorageId.entries()) {
      const [clusterId, mountPath] = mappingKey.split("::");
      const escapedClusterId = escapeSqlString(clusterId);
      const escapedMountPath = escapeSqlString(mountPath);
      const escapedStorageId = escapeSqlString(storageId);

      await this.execute(
        "update `tenant_storage_quota` " +
          `set \`storage_id\` = '${escapedStorageId}' ` +
          `where \`cluster\` = '${escapedClusterId}' and \`path\` = '${escapedMountPath}';`,
      );

      await this.execute(
        "update `tenant_user_storage_quota` " +
          `set \`storage_id\` = '${escapedStorageId}' ` +
          `where \`cluster\` = '${escapedClusterId}' and \`path\` = '${escapedMountPath}';`,
      );
    }

    // 校验：不允许存在未映射的行（storage_id 仍为 NULL）
    const unmappedTenantStorageQuotas = (await this.execute(
      "select `id`, `cluster`, `path` from `tenant_storage_quota` where `storage_id` is null;",
    )) as { id: number; cluster: string; path: string }[];
    if (unmappedTenantStorageQuotas.length > 0) {
      const first = unmappedTenantStorageQuotas[0];
      throw new Error(
        `Found unmapped tenant_storage_quota row: ` + `id=${first.id}, cluster=${first.cluster}, path=${first.path}`,
      );
    }

    const unmappedTenantUserStorageQuotas = (await this.execute(
      "select `id`, `cluster`, `path` from `tenant_user_storage_quota` where `storage_id` is null;",
    )) as { id: number; cluster: string; path: string }[];
    if (unmappedTenantUserStorageQuotas.length > 0) {
      const first = unmappedTenantUserStorageQuotas[0];
      throw new Error(
        `Found unmapped tenant_user_storage_quota row: ` +
          `id=${first.id}, cluster=${first.cluster}, path=${first.path}`,
      );
    }

    // 校验：不允许存在重复的 (tenant_id, storage_id) / (user_id, storage_id) 组合，
    //       否则下一步添加唯一约束会失败
    const duplicateTenantStorageQuotas = (await this.execute(
      "select `tenant_id`, `storage_id`, count(*) as `count` " +
        "from `tenant_storage_quota` " +
        "group by `tenant_id`, `storage_id` having count(*) > 1;",
    )) as { tenant_id: number; storage_id: string; count: number }[];
    if (duplicateTenantStorageQuotas.length > 0) {
      const first = duplicateTenantStorageQuotas[0];
      throw new Error(
        `Duplicate tenant_storage_quota rows for tenant_id=${first.tenant_id}, ` +
          `storage_id=${first.storage_id}, count=${first.count}`,
      );
    }

    const duplicateTenantUserStorageQuotas = (await this.execute(
      "select `user_id`, `storage_id`, count(*) as `count` " +
        "from `tenant_user_storage_quota` " +
        "group by `user_id`, `storage_id` having count(*) > 1;",
    )) as { user_id: number; storage_id: string; count: number }[];
    if (duplicateTenantUserStorageQuotas.length > 0) {
      const first = duplicateTenantUserStorageQuotas[0];
      throw new Error(
        `Duplicate tenant_user_storage_quota rows for user_id=${first.user_id}, ` +
          `storage_id=${first.storage_id}, count=${first.count}`,
      );
    }

    // 3. 数据已就绪，添加唯一约束并将列改为 NOT NULL
    await this.execute(
      `alter table \`tenant_storage_quota\` add unique \`tenant_storage_quota_tenant_id_storage_id_unique\`(\`tenant_id\`, \`storage_id\`);`,
    );
    await this.execute(
      `alter table \`tenant_user_storage_quota\` add unique \`tenant_user_storage_quota_user_id_storage_id_unique\`(\`user_id\`, \`storage_id\`);`,
    );
    await this.execute(
      `alter table \`tenant_storage_quota\` modify \`storage_id\` varchar(255) not null comment '文件系统 storageId';`,
    );
    await this.execute(
      `alter table \`tenant_user_storage_quota\` modify \`storage_id\` varchar(255) not null comment '文件系统 storageId';`,
    );

    // 4. 删除旧的 (cluster, user_id, path) 唯一约束，已被 (user_id, storage_id) 替代
    await this.execute(
      `alter table \`tenant_user_storage_quota\` drop index \`tenant_user_storage_quota_cluster_user_id_path_unique\`;`,
    );

    // 5. 单位换算：Bytes → MB（整除 1048576）
    //    storage_quota / usage 为可空 bigint，NULL 行保持不变
    await this.execute(
      "update `tenant_storage_quota` set `user_default_quota` = `user_default_quota` div 1048576;",
    );
    await this.execute(
      "update `tenant_user_storage_quota` set `storage_quota` = `storage_quota` div 1048576 where `storage_quota` is not null;",
    );
    await this.execute(
      "update `tenant_user_storage_quota` set `usage` = `usage` div 1048576;",
    );
  }

  override async down(): Promise<void> {
    // 单位回滚：MB → Bytes（乘以 1048576）
    await this.execute(
      "update `tenant_storage_quota` set `user_default_quota` = `user_default_quota` * 1048576;",
    );
    await this.execute(
      "update `tenant_user_storage_quota` set `storage_quota` = `storage_quota` * 1048576 where `storage_quota` is not null;",
    );
    await this.execute(
      "update `tenant_user_storage_quota` set `usage` = `usage` * 1048576;",
    );

    // 恢复旧唯一约束
    await this.execute(
      `alter table \`tenant_user_storage_quota\` add unique \`tenant_user_storage_quota_cluster_user_id_path_unique\`(\`cluster\`, \`user_id\`, \`path\`);`,
    );

    // 删除 storage_id 相关的索引、唯一约束和列
    await this.execute(`alter table \`tenant_storage_quota\` drop index \`idx_storage_id\`;`);
    await this.execute(
      `alter table \`tenant_storage_quota\` drop index \`tenant_storage_quota_tenant_id_storage_id_unique\`;`,
    );
    await this.execute(`alter table \`tenant_storage_quota\` drop column \`storage_id\`;`);

    await this.execute(`alter table \`tenant_user_storage_quota\` drop index \`idx_storage_id\`;`);
    await this.execute(
      `alter table \`tenant_user_storage_quota\` drop index \`tenant_user_storage_quota_user_id_storage_id_unique\`;`,
    );
    await this.execute(`alter table \`tenant_user_storage_quota\` drop column \`storage_id\`;`);
  }
}
