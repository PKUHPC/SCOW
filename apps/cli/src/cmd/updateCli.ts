import { Octokit } from "@octokit/rest";
import fs, { existsSync } from "fs";
import { chmod, unlink } from "fs/promises";
import JSZip from "jszip";
// node-fetch is esm only
import fetch from "node-fetch-commonjs";
import prompt from "prompts";
import { createProxyAgent, proxyUrl } from "src/config/proxy";
import { logger } from "src/log";
import { pipeline } from "stream/promises";

interface Options {
  configPath: string;
  pr: number | undefined;
  release: string | undefined;
  branch: string | undefined;
  downloadPath?: string;
}

const owner = "PKUHPC";
const repo = "private-scow";
const workflow_id = "test-build-publish.yaml";

const allowedArch = ["x64", "arm64"];

function getArch() {
  const arch = process.arch;

  if (!allowedArch.includes(arch)) {
    throw new Error("Unsupported architecture: " + arch);
  }

  return arch;
}

async function getBranchName(prNumber: number, octokit: Octokit) {
  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });

  return pr.data.head.ref;
}

async function download(...params: Parameters<typeof fetch>) {
  const res = await fetch(...params);

  if (!res.ok) {
    throw new Error(`Non-ok response ${res.status} during download. Body: ${await res.text()}`);
  }

  return res.arrayBuffer();
}

export const updateCli = async (options: Options) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const outputPath = options.downloadPath ? options.downloadPath : process.execPath;

  logger.debug("Output path is %s", outputPath);

  if (options.downloadPath && existsSync(outputPath)) {
    const answer = await prompt({
      type: "confirm",
      name: "continue",
      message: `Output path ${outputPath} already exists. Continue?`,
    });
    if (!answer.continue) {
      logger.debug("Selected no.");
      return;
    }
  }

  const agent = proxyUrl ? createProxyAgent(proxyUrl) : undefined;

  if (proxyUrl) {
    logger.info("Using proxy %s", proxyUrl);
  }

  const arch = getArch();

  // built-in fetch doesn't work with proxy
  // https://github.com/octokit/rest.js/issues/43
  const octokit = new Octokit({ auth: GITHUB_TOKEN, request: { agent, fetch } });

  if (options.pr || options.branch) {
    if (!GITHUB_TOKEN) {
      logger.info(`
Download CLI from PR or branch requires GitHub authentication,
and the authenticated user/token must have actions scope.
See: https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28#download-an-artifact

Please provide your GitHub personal access token via GITHUB_TOKEN in env or .env file.
    `);

      return;
    }

    const user = await octokit.rest.users.getAuthenticated();
    logger.debug("GitHub authenticated %s via GITHUB_TOKEN env.", user.data.login);

    const branch = options.branch ? options.branch : await getBranchName(options.pr!, octokit);
    logger.info("Branch: %s", branch);

    logger.debug("Download cli for PR %s", options.pr);

    const runs = await octokit.rest.actions.listWorkflowRuns({ owner, repo, workflow_id, branch });

    const latestRun = runs.data.workflow_runs[0];

    logger.debug("Latest run: %s. Run URL: %s", String(latestRun.id), latestRun.html_url);

    logger.debug("Architecture: %s", arch);

    const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({ owner, repo, run_id: latestRun.id });

    const artifactName = "scow-cli-" + arch;

    const artifact = artifacts.data.artifacts.find((a) => a.name === artifactName);

    if (!artifact) {
      throw new Error("Cannot find artifact for architecture " + arch);
    }

    logger.info("Artifact: %s. Download URL: %s", artifact.name, artifact.archive_download_url);

    logger.info("Downloading...");
    const content = await octokit.rest.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: artifact.id,
      archive_format: "zip",
    });

    if (!(content.data instanceof ArrayBuffer)) {
      throw new Error("Downloaded content is not ArrayBuffer");
    }

    logger.info("Download completed. Unzip");
    const binaryName = "cli-" + arch;

    const jszip = new JSZip();
    const zip = await jszip.loadAsync(content.data);
    const file = zip.file(binaryName);

    if (!file) {
      throw new Error("Cannot find binary file " + binaryName);
    }

    await unlink(outputPath);
    await pipeline(file.nodeStream(), fs.createWriteStream(outputPath));
    await chmod(outputPath, 0o755);

    if (options.downloadPath) {
      logger.info("CLI of specified PR or branch has been downloaded to %s", outputPath);
    } else {
      logger.info("CLI has been updated.");
    }

    return;
  }

  const release = await (async function () {
    if (!options.release) {
      logger.info("Neither --pr, --release nor --branch is specified. Downloading latest release.");
      const resp = await octokit.rest.repos.getLatestRelease({ owner, repo });
      logger.info("Latest release is %s.", resp.data.tag_name);
      return resp.data;
    } else {
      logger.info("Downloading release %s", options.release);
      const resp = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag: options.release });
      return resp.data;
    }
  })();

  const assetName = "cli-" + arch;

  const asset = release.assets.find((a) => a.name === assetName);

  if (!asset) {
    throw new Error("Cannot find asset for architecture " + arch);
  }

  logger.info("Asset: %s. Download URL: %s", asset.name, asset.browser_download_url);

  logger.info("Downloading...");
  const content = await download(asset.browser_download_url, { agent });

  await unlink(outputPath);
  await fs.promises.writeFile(outputPath, Buffer.from(content));
  await chmod(outputPath, 0o755);

  logger.info("Downloaded release %s", release.name ?? "");
};
