import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { Migration } from "@mikro-orm/migrations";
import { join } from "path";
import { configClusters } from "src/config/clusters";
import { portalConfig } from "src/config/portal";
import { logger } from "src/utils/logger";
import { getScowdClient } from "src/utils/scowd";

// 每个集群内最多同时读取 5 个用户，避免用户数较多时串行迁移太慢；
// 同时也避免无限并发把 scowd 打满。
const USER_READ_CONCURRENCY = 5;

// 每类失败只保留前 10 条样例，避免日志和内存占用随用户数无限增长。
const FAILURE_SAMPLE_LIMIT = 10;

// migration 里只需要 user_id，避免通过实体加载触发无关字段/关系。
interface UserRow {
  user_id: string;
}

// 不按数据库中的集群激活状态过滤；后面只按当前配置里的 hpc.enabled 过滤。
interface ClusterRow {
  cluster_id: string;
}

// 历史文件来自用户家目录，不能假设 JSON 字段一定完整或类型正确。
// 所以这里把字段声明为 unknown，后续逐个字段做保守转换。
interface LegacyJobTemplate {
  jobName?: unknown;
  account?: unknown;
  cluster?: unknown;
  partition?: unknown;
  qos?: unknown;
  nodeCount?: unknown;
  coreCount?: unknown;
  gpuCount?: unknown;
  maxTime?: unknown;
  maxTimeUnit?: unknown;
  command?: unknown;
  memory?: unknown;
  submitTime?: unknown;
}

// 对应 job_template 表的列名。这里使用 snake_case，是为了直接交给 knex insert。
interface JobTemplateInsert {
  user_id: string;
  cluster: string;
  template_name: string;
  account: string;
  partition: string;
  qos: string;
  node_count: number;
  core_count: number;
  gpu_count: number;
  max_time: number;
  max_time_unit: "MINUTE" | "HOUR" | "DAY";
  memory_mb?: number;
  command?: string;
  created_at: Date;
}

interface LegacyTemplateFile {
  name: string;
  content: string;
}

interface MigrationFailureSample {
  cluster: string;
  userId: string;
  file?: string;
  error: string;
}

interface MigrationStats {
  migratedTemplates: number;
  failedUserClusterReads: number;
  failedFileReads: number;
  failedTemplateMigrations: number;
  userClusterReadFailureSamples: MigrationFailureSample[];
  fileReadFailureSamples: MigrationFailureSample[];
  templateMigrationFailureSamples: MigrationFailureSample[];
}

// MikroORM migration 没有业务 logger 注入，使用全局 logger，并统一加 migration 前缀方便检索。
const logInfo = (message: string, ...args: unknown[]) => {
  logger.info(`[MigrationForJobTemplate20260706] ${message}`, ...args);
};

const logWarn = (message: string, ...args: unknown[]) => {
  logger.warn(`[MigrationForJobTemplate20260706] ${message}`, ...args);
};

const toErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

const addFailureSample = (samples: MigrationFailureSample[], sample: MigrationFailureSample) => {
  if (samples.length < FAILURE_SAMPLE_LIMIT) {
    samples.push(sample);
  }
};

const logFailureSamples = (title: string, total: number, samples: MigrationFailureSample[]) => {
  if (total > 0) {
    logWarn("%s: total=%d, samples=%o", title, total, samples);
  }
};

const runWithConcurrency = async <T>(items: T[], concurrency: number, run: (item: T) => Promise<void>) => {
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      await run(items[currentIndex]);
    }
  });

  await Promise.all(workers);
};

const toOptionalString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const toStringOrEmpty = (value: unknown): string => {
  return toOptionalString(value) ?? "";
};

// 数值字段写入数据库前必须兜底，否则一个坏模板会导致该文件插入失败。
// 历史模板中的 node/core/gpu/maxTime 都按非负整数处理。
const toNonNegativeInteger = (value: unknown, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(value));
};

// 旧版提交作业使用 memory 字符串，例如 1024M 或 1024MB。
// 新表使用 memory_mb 数字；无法识别的值不迁移，保持为 NULL。
const parseMemoryMb = (value: unknown): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(M|MB)$/i);

  if (!match) {
    return undefined;
  }

  const memoryMb = Number(match[1]);

  return Number.isFinite(memoryMb) ? Math.trunc(memoryMb) : undefined;
};

// 历史模板的 submitTime 作为新表 created_at。
// 无 submitTime 或日期非法时使用当前时间，确保迁移不会被脏数据中断。
const parseCreatedAt = (value: unknown): Date => {
  if (typeof value !== "string") {
    return new Date();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
};

// 旧版 portal proto 使用 MINUTES/HOURS/DAYS，或者可能以 0/1/2 数字形式落盘。
// 新版 MIS 实体 enum 是 MINUTE/HOUR/DAY，这里做兼容映射。
const parseMaxTimeUnit = (value: unknown): JobTemplateInsert["max_time_unit"] => {
  switch (value) {
    case 1:
    case "1":
    case "HOUR":
    case "HOURS":
      return "HOUR";
    case 2:
    case "2":
    case "DAY":
    case "DAYS":
      return "DAY";
    case 0:
    case "0":
    case "MINUTE":
    case "MINUTES":
    default:
      return "MINUTE";
  }
};

// 将单个历史 JSON 转成 job_template 表记录。
// 字段缺失时尽量给出与旧 listJobTemplates 类似的保守默认值；
// cluster 优先使用历史数据里的值，没有时使用当前正在扫描的集群。
const toInsert = (userId: string, cluster: string, fileName: string, data: LegacyJobTemplate): JobTemplateInsert => {
  const templateName = toOptionalString(data.jobName) || fileName;

  return {
    user_id: userId,
    cluster: toOptionalString(data.cluster) || cluster,
    template_name: templateName,
    account: toStringOrEmpty(data.account),
    partition: toStringOrEmpty(data.partition),
    qos: toStringOrEmpty(data.qos),
    node_count: toNonNegativeInteger(data.nodeCount, 0),
    core_count: toNonNegativeInteger(data.coreCount, 0),
    gpu_count: toNonNegativeInteger(data.gpuCount, 0),
    max_time: toNonNegativeInteger(data.maxTime, 0),
    max_time_unit: parseMaxTimeUnit(data.maxTimeUnit),
    memory_mb: parseMemoryMb(data.memory),
    command: toOptionalString(data.command),
    created_at: parseCreatedAt(data.submitTime),
  };
};

const createCandidateTemplateName = (baseName: string, duplicateIndex: number) => {
  return duplicateIndex === 0 ? baseName : `${baseName}-${duplicateIndex}`;
};

const isUniqueConstraintError = (error: unknown) => {
  return (
    error instanceof UniqueConstraintViolationException ||
    (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY")
  );
};

const insertWithAvailableTemplateName = async (
  knex: ReturnType<Migration["getKnex"]>,
  insert: JobTemplateInsert,
): Promise<string> => {
  const baseTemplateName = insert.template_name;

  for (let duplicateIndex = 0; ; duplicateIndex += 1) {
    const templateName = createCandidateTemplateName(baseTemplateName, duplicateIndex);
    const existed = await knex("job_template")
      .select("id")
      .where({ user_id: insert.user_id, template_name: templateName })
      .first();

    if (existed) {
      continue;
    }

    try {
      await knex("job_template").insert({ ...insert, template_name: templateName });
      return templateName;
    } catch (error) {
      // 并发迁移同一用户的多个同名模板时，可能在 exists 和 insert 之间被其它任务抢先插入。
      // 这种情况下继续尝试下一个 -N 后缀，保证尽量不丢历史模板。
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }
};

// scowd 集群通过 scowd file service 获取用户家目录并读取 savedJobs。
// 目录不存在视为该用户没有历史模板，返回空数组。
const readScowdTemplateFiles = async (
  cluster: string,
  userId: string,
  stats: MigrationStats,
): Promise<LegacyTemplateFile[]> => {
  const client = getScowdClient(cluster, userId);
  const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
  const savedJobsDir = join(userHomeDir, portalConfig.savedJobsDir);
  const { exists } = await client.file.exists({ userId, path: savedJobsDir });

  if (!exists) {
    return [];
  }

  const { filesInfo } = await client.file.readDirectory({ userId, dirPath: savedJobsDir });
  const files: LegacyTemplateFile[] = [];

  for (const { name } of filesInfo) {
    try {
      // 单个文件读取失败只跳过该文件，不能影响同目录下其它模板。
      const filePath = join(savedJobsDir, name);
      const { content } = await client.file.readFile({ userId, filePath });
      files.push({ name, content: Buffer.from(content).toString() });
    } catch (error) {
      stats.failedFileReads += 1;
      addFailureSample(stats.fileReadFailureSamples, {
        cluster,
        userId,
        file: name,
        error: toErrorMessage(error),
      });
    }
  }

  return files;
};

export class MigrationForJobTemplate20260706 extends Migration {
  override async up(): Promise<void> {
    const knex = this.getKnex();
    const stats: MigrationStats = {
      migratedTemplates: 0,
      failedUserClusterReads: 0,
      failedFileReads: 0,
      failedTemplateMigrations: 0,
      userClusterReadFailureSamples: [],
      fileReadFailureSamples: [],
      templateMigrationFailureSamples: [],
    };

    // 只迁移正常用户；已删除用户的历史模板不再导入新表。
    const users = await knex<UserRow>("user").select("user_id").where("state", "NORMAL");
    // 集群不按 activation_status 过滤，后续只用 configClusters 的 hpc.enabled 判断是否迁移。
    const clusters = await knex<ClusterRow>("cluster").select("cluster_id");

    const hpcEnabledClusters = clusters
      .map(({ cluster_id }) => cluster_id)
      .filter((clusterId) => {
        const clusterConfig = configClusters[clusterId];

        if (!clusterConfig) {
          // 数据库中存在、但当前配置不存在的集群无法确定 login/scowd 信息，只能跳过。
          logWarn("Skip cluster not found in configClusters. cluster=%s", clusterId);
          return false;
        }

        if (clusterConfig.hpc.enabled !== true) {
          // 只迁移 HPC enabled 集群；AI-only 或关闭 HPC 的集群不处理历史作业模板。
          logInfo("Skip cluster because hpc is not enabled. cluster=%s", clusterId);
          return false;
        }

        return true;
      });

    logInfo("Start migrating job templates. users=%d, clusters=%d", users.length, hpcEnabledClusters.length);

    const migrateUserInCluster = async (cluster: string, userId: string) => {
      let files: LegacyTemplateFile[];

      try {
        // 用户/集群级别读取失败只影响当前组合，不能中断整个 migration。
        files = await readScowdTemplateFiles(cluster, userId, stats);
      } catch (error) {
        stats.failedUserClusterReads += 1;
        addFailureSample(stats.userClusterReadFailureSamples, {
          cluster,
          userId,
          error: toErrorMessage(error),
        });
        return;
      }

      for (const file of files) {
        try {
          // 文件级别解析和入库失败都在这里兜底，确保坏 JSON 不影响其它模板。
          const data = JSON.parse(file.content) as LegacyJobTemplate;
          const insert = toInsert(userId, cluster, file.name, data);
          // 新表唯一键是 user_id + template_name。
          // 早期历史模板以作业名作为模板名，而作业名允许重复，所以冲突时追加 -1、-2 等后缀继续迁移。
          await insertWithAvailableTemplateName(knex, insert);
          stats.migratedTemplates += 1;
        } catch (error) {
          stats.failedTemplateMigrations += 1;
          addFailureSample(stats.templateMigrationFailureSamples, {
            cluster,
            userId,
            file: file.name,
            error: toErrorMessage(error),
          });
        }
      }
    };

    await Promise.all(
      hpcEnabledClusters.map(async (cluster) => {
        // 集群之间可以并发迁移；每个集群内部再限制最多 USER_READ_CONCURRENCY 个用户同时读远程文件。
        await runWithConcurrency(users, USER_READ_CONCURRENCY, async ({ user_id: userId }) => {
          await migrateUserInCluster(cluster, userId);
        });
      }),
    );

    logInfo(
      "Finished migrating job templates. migrated=%d, failedUserClusterReads=%d, failedFileReads=%d, failedTemplateMigrations=%d",
      stats.migratedTemplates,
      stats.failedUserClusterReads,
      stats.failedFileReads,
      stats.failedTemplateMigrations,
    );

    logFailureSamples(
      "User/cluster read failure samples",
      stats.failedUserClusterReads,
      stats.userClusterReadFailureSamples,
    );
    logFailureSamples("File read failure samples", stats.failedFileReads, stats.fileReadFailureSamples);
    logFailureSamples(
      "Template migration failure samples",
      stats.failedTemplateMigrations,
      stats.templateMigrationFailureSamples,
    );
  }

  override async down(): Promise<void> {
    logInfo("Skip down migration because migrated templates may have been modified by users.");
  }
}
