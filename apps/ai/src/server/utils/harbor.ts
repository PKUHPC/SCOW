import { aiConfig } from "../config/ai";
import { getUserHarborProjectName } from "./image";
import { logger } from "./logger";

export const { protocol:harborProtocol,
  url: harborUrl,
  user: harborUser,
  password: harborPassword,
  project:harborProject } = aiConfig.harborConfig;

function doubleEncode(str: string) {
  return encodeURIComponent(encodeURIComponent(str));
}
export interface HarborConfig {
  protocol: string;
  project: string;
  url: string;
  username: string;
  password: string;
}

export class HarborClient {
  private base: string;
  private authHeader: string;
  private pageSize = 100;

  constructor(private cfg: HarborConfig) {
    this.base = `${cfg.protocol}://${cfg.url.replace(/\/+$/, "")}/api/v2.0`;
    this.authHeader =
      "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
  }

  /** 约定：除 409 以外的非 ok 都抛错；409 视为“已存在/成功” */
  private async harborFetch(url: string, options: RequestInit = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok && res.status !== 409) {
      const msg = await res.text().catch(() => "");
      throw new Error(`${options.method || "GET"} ${url} ⇒ ${res.status} ${msg}`);
    }
    return res;
  }

  async getRepositories(project: string) {
    logger.info(`[Harbor] Fetch repos for project=${project} ...`);
    let page = 1,
      repos: any[] = [],
      hasMore = true,
      total = 0;

    while (hasMore) {
      const res = await this.harborFetch(
        `${this.base}/projects/${project}/repositories?page=${page}&page_size=${this.pageSize}`,
      );
      const data = await res.json();
      repos = repos.concat(data);
      hasMore = data.length === this.pageSize;
      total += data.length;
      logger.info(`[Harbor] page ${page}: +${data.length} (total=${total})`);
      page++;
    }
    logger.info(`[Harbor] total repos=${repos.length}`);
    return repos;
  }

  async getArtifacts(fullRepoName: string, project: string) {
    const repoPath = fullRepoName.replace(`${project}/`, "");
    let page = 1,
      artifacts: any[] = [],
      hasMore = true,
      total = 0;

    while (hasMore) {
      const res = await this.harborFetch(
        `${this.base}/projects/${project}/repositories/${doubleEncode(
          repoPath,
        )}/artifacts?page=${page}&page_size=${this.pageSize}&with_tag=true`,
      );
      const data = await res.json();
      artifacts = artifacts.concat(data);
      hasMore = data.length === this.pageSize;
      total += data.length;
      logger.info(`[Harbor] ${repoPath} artifacts p${page}: +${data.length} (total=${total})`);
      page++;
    }
    return artifacts;
  }

  async ensureProjectExists(projectName: string) {
    logger.info(`[Harbor] ensure project ${projectName}`);
    const head = await fetch(`${this.base}/projects/${projectName}`, {
      headers: { Authorization: this.authHeader, Accept: "application/json" },
    });
    if (head.ok || head.status === 409) return true;

    if (head.status === 404) {
      const r = await this.harborFetch(`${this.base}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: projectName, public: true }),
      });
      if (!r.ok && r.status !== 409) {
        throw new Error(`Failed to create project ${projectName}`);
      }
      logger.info(`[Harbor] created project ${projectName}`);
      return true;
    }

    const msg = await head.text().catch(() => "");
    throw new Error(`Failed to check project ${projectName}: ${head.status} ${msg}`);
  }

  async copyArtifact(p: {
    srcProject: string;
    srcRepo: string;
    tag: string;
    destProject: string;
    destRepo: string;
  }) {
    const fromRef = `${p.srcProject}/${p.srcRepo}:${p.tag}`;
    const url = new URL(
      `${this.base}/projects/${p.destProject}/repositories/${doubleEncode(p.destRepo)}/artifacts`,
    );
    url.searchParams.set("from", fromRef);

    const res = await this.harborFetch(url.href, { method: "POST" });
    if (res.status === 409) {
      logger.info(`[Skip] exists: ${p.destProject}/${p.destRepo}:${p.tag}`);
    } else {
      logger.info(`[OK] copied: ${fromRef} ⇒ ${p.destProject}/${p.destRepo}:${p.tag}`);
    }
  }

  async getReference(p: {
    userId: string,
    imageName: string,
  }) {
    const url = `${this.base}/projects`
        + `/${getUserHarborProjectName(p.userId)}/repositories/${p.imageName}/artifacts`;

    return await this.harborFetch(url);
  }

  async deleteRepository(p: {
    userId: string,
    imageName: string,
  }) {

    const url = `${this.base}/projects`
        + `/${getUserHarborProjectName(p.userId)}/repositories/${p.imageName}`;

    return await this.harborFetch(url, { method: "DELETE" });
  }

  async deleteTag(p: {
    userId: string,
    imageName: string,
    reference: string,
    imageTag: string,
    imageTagPostfix: string,
  }) {
    const url = `${this.base}/projects`
        + `/${getUserHarborProjectName(p.userId)}/repositories/${p.imageName}`
        + `/artifacts/${p.reference}/tags/${p.imageTag + (p.imageTagPostfix ?? "")}`;

    return await this.harborFetch(url, { method: "DELETE" });
  }

  async getHarborConfig() {
    const url = `${this.base}/configurations`;

    // 需要具备读取系统配置的权限（通常是 admin）
    return await this.harborFetch(url);
  }

  async getProjectSummary(projectName: string) {
    const url = `${this.base}/projects/${projectName}/summary`;

    return await this.harborFetch(url, { headers: { "X-Is-Resource-Name": "true" } });
  }

  async getProjectInfo(projectName: string) {
    const url = `${this.base}/projects/${projectName}`;

    return await this.harborFetch(url, { headers: { "X-Is-Resource-Name": "true" } });
  }


  async createProject(projectName: string) {
    const url = `${this.base}/projects`;

    return await this.harborFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: projectName,
        public: true,
      }),
    });
  }
}


export function getHarborConfig(): HarborConfig {
  return {
    protocol:harborProtocol,
    project:harborProject,
    url: harborUrl,
    username: harborUser,
    password: harborPassword,
  };
}
