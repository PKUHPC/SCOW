import { Migration } from "@mikro-orm/migrations";

import { getHarborConfig, HarborClient } from "../utils/harbor";
import { logger } from "../utils/logger";


/** ========== 复制任务：从 {sourceProject}/* 复制到各 u_${userId}/* ========== */
async function runHarborCopy(h: HarborClient, sourceProject: string) {
  const repos = await h.getRepositories(sourceProject); // 形如 at/uid123/app
  for (const repo of repos) {
    const fullName: string = repo.name; // e.g. at/uid123/app
    const repoPath = fullName.replace(`${sourceProject}/`, ""); // uid123/app
    const [userId, ...rest] = repoPath.split("/"); // userId = uid123

    if (!userId || rest.length === 0) {
      logger.info(`[Harbor] skip invalid: ${fullName}`);
      continue;
    }

    const trimmed = [...rest];
    const destRepo = trimmed.join("/"); // app
    const projectName = `u_${userId}`; // 目标项目 u_at


    logger.info(`[Harbor] repo=${fullName} → project=${projectName}, destRepo=${destRepo}`);

    await h.ensureProjectExists(projectName);

    const artifacts = await h.getArtifacts(fullName, sourceProject);
    for (const art of artifacts) {
      for (const t of art.tags || []) {
        await h.copyArtifact({
          srcProject: sourceProject,
          srcRepo: repoPath,
          tag: t.name,
          destProject: projectName,
          destRepo,
        });
      }
    }
  }
}

/** ========== Mikro-ORM Migration ========== */
export class MigrationImageData20250819 extends Migration {

  override async up(): Promise<void> {
    const harborConfig = getHarborConfig();
    if (!harborConfig) {
      logger.info(
        "[SKIP] Missing Harbor env (HARBOR_PROTOCOL / HARBOR_PROJECT / HARBOR_URL / HARBOR_USERNAME / HARBOR_PASSWORD)."
        + "Skip migration up().");
      return;
    }
    const { project } = harborConfig;

    logger.info("=== [Harbor Copy] Start ===");
    const harbor = new HarborClient(harborConfig);
    await runHarborCopy(harbor, project); // 任意非 409 错误会 throw，中断迁移（DB 不改）
    logger.info("=== [Harbor Copy] Done. Proceed to DB UPDATE ===");

    // 只改“第二段是 {project}”的路径，且避免已是 u_ 前缀的重复处理
    const updateSql = `
      UPDATE image
      SET path = REGEXP_REPLACE(
        path,
        '^([^/]+)/${project}/([^/]+)/(.*)$',
        '$1/u_$2/$3'
      )
      WHERE path REGEXP '^[^/]+/${project}/[^/]+/'
        AND path NOT REGEXP '^[^/]+/${project}/u_[^/]+/';
    `;

    // 已在迁移的事务中
    this.addSql(updateSql);
  }

  override async down(): Promise<void> {
    const harborConfig = getHarborConfig();
    if (!harborConfig) {
      logger.info(
        "[SKIP] Missing Harbor env (HARBOR_PROTOCOL / HARBOR_PROJECT / HARBOR_URL / HARBOR_USERNAME / HARBOR_PASSWORD)."
        + "Skip migration up().",
      );
      return;
    }
    const { project } = harborConfig;

    // 可逆：把 u_ 段还原，并插回固定的第二段 的 {project}
    const revertSql = `
      UPDATE image
      SET path = REGEXP_REPLACE(
        path,
        '^([^/]+)/u_([^/]+)/(.*)$',
        '$1/${project}/$2/$3'
      )
      WHERE path REGEXP '^[^/]+/u_[^/]+/';
    `;

    // 已在迁移的事务中
    this.addSql(revertSql);
  }
}
