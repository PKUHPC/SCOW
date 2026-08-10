const fs = require("node:fs");
const path = require("node:path");

const STATE_HEADING = "## AI Review 门禁";
const STATE_MARKER_PREFIX = "<!-- scow-pr-agent-gate-state:";
const REVIEW_HEADER = "## PR Reviewer Guide";
const IMPROVE_HEADER = "## PR Code Suggestions ✨";
const ACK_TEXT = "我已逐项处理本轮 AI Review 建议：已采纳修改，或已在 PR 评论中说明不采纳理由。";
const REQUIRED_HEADINGS = [
  "## PR 类型",
  "## 关联信息",
  "## 变更说明",
  "## 问题与根因",
  "## 影响范围",
  "## 方案说明",
  "## 风险点",
  "## 自测情况",
  "## 测试建议",
  "## 复盘与改进",
];
const REQUIRED_FIELD_PREFIXES = [
  "需求 / Bug / PR 链接：",
  "多维表格任务链接：",
  "本次主要改动 / 修复内容：",
  "涉及模块：",
  "是否包含接口 / 配置 / 权限变更：",
  "是否涉及 UI 改动，如果有补充截图",
  "问题现象：",
  "复现条件：",
  "实际结果：",
  "期望结果：",
  "根因：",
  "影响的页面 / API / 服务：",
  "可能受影响的历史逻辑：",
  "是否影响兼容性：",
  "是否需要配置调整 / 运维兼容处理：",
  "实现 / 修复思路：",
  "关键设计取舍：",
  "是否有替代方案，为什么未采用：",
  "Refactor 类 PR 需说明：是否改变原有行为：",
  "主要风险：",
  "边界场景：",
  "是否存在同类问题：",
  "建议重点验证：",
  "建议回归范围：",
  "需要特别关注的场景：",
  "是否需要进入复盘：",
  "是否属于共性问题：",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPrNumber(context) {
  return context.payload.pull_request?.number ?? context.payload.issue?.number;
}

function getTool(eventName, payload, { humanReviewStarted = false } = {}) {
  if (eventName === "pull_request_target" && payload.action === "opened") {
    return "automatic";
  }

  if (eventName === "pull_request_target" && payload.action === "synchronize" && !humanReviewStarted) {
    return "automatic_review";
  }

  if (eventName !== "issue_comment" || !payload.issue?.pull_request) {
    return "";
  }

  // Do not allow online config overrides to weaken repository-owned review settings.
  const match = payload.comment?.body?.trim().match(/^\/(describe|review|improve)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function getCleanupKind(tool) {
  if (tool === "automatic" || tool === "automatic_review" || tool === "review") return "review";
  if (tool === "improve") return "improve";
  return "";
}

function encodeState(state) {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeState(body = "") {
  const start = body.indexOf(STATE_MARKER_PREFIX);
  if (start === -1) return null;

  const valueStart = start + STATE_MARKER_PREFIX.length;
  const end = body.indexOf(" -->", valueStart);
  if (end === -1) return null;

  try {
    return JSON.parse(Buffer.from(body.slice(valueStart, end), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function createState() {
  return {
    version: 1,
    humanReviewStarted: false,
    reviewHeadSha: null,
    reviewRunId: null,
    acknowledgedReviewRunId: null,
    acknowledgedBy: null,
    descriptionValid: false,
    lastRunError: null,
  };
}

function isReviewCurrent(state, headSha) {
  return Boolean(state.reviewRunId && state.reviewHeadSha === headSha);
}

function isAcknowledged(state, pullRequest) {
  return Boolean(
    isReviewCurrent(state, pullRequest.head.sha) &&
    state.acknowledgedReviewRunId === state.reviewRunId &&
    state.acknowledgedBy === pullRequest.user.login,
  );
}

function isEligible(state, pullRequest) {
  if (state.humanReviewStarted) return true;
  return Boolean(state.descriptionValid && isAcknowledged(state, pullRequest));
}

function hasHumanReviewRoutingState(pullRequest) {
  return (pullRequest.labels ?? []).some((label) =>
    /^(?:Code[123]|E2E)-(?:ReviewRequested|Approved|ChangeRequested|Skipped)$|^ReadyForMerge$/u.test(label.name),
  );
}

function renderState(state, pullRequest) {
  if (state.humanReviewStarted) {
    const marker = `${STATE_MARKER_PREFIX}${encodeState(state)} -->`;
    return `${marker}
${STATE_HEADING}

- 当前阶段：初始 AI 门禁已完成，正在进行人工 Review
- 后续提交：不会转回 Draft；可按需手动使用 /review
- 人工审核状态：以 PR 上的 Code1 / Code2 / Code3 / E2E 标签为准

/improve 可按需手动生成具体代码修改建议，但不参与门禁。`;
  }

  const reviewCurrent = isReviewCurrent(state, pullRequest.head.sha);
  const acknowledged = isAcknowledged(state, pullRequest);
  const marker = `${STATE_MARKER_PREFIX}${encodeState(state)} -->`;
  const reviewStatus = reviewCurrent ? `已针对 \`${pullRequest.head.sha.slice(0, 7)}\` 执行` : "未针对当前提交执行";
  const descriptionStatus = state.descriptionValid ? "格式有效" : "格式无效或尚未生成";
  const acknowledgementStatus = acknowledged ? `已由 @${state.acknowledgedBy} 确认` : "等待 PR 作者确认";
  const error = state.lastRunError ? `\n- 最近一次调用：${state.lastRunError}` : "";

  return `${marker}
${STATE_HEADING}

- 当前提交：\`${pullRequest.head.sha.slice(0, 7)}\`
- \`/review\`：${reviewStatus}
- PR 描述：${descriptionStatus}
- 作者确认：${acknowledgementStatus}${error}

- [${acknowledged ? "x" : " "}] ${ACK_TEXT}

创建 PR 时会自动执行一次 \`/describe\` 和 \`/review\`。推送新提交后会自动执行 \`/review\`；需要更新描述时评论 \`/describe\`。

> **PR 作者操作：** 处理完本轮 AI Review 后，先勾选上方确认框，再点击 **Ready for review**。完成这两步后，Draft PR 才会转为正式 PR 并进入人工 Review。

\`/improve\` 可按需手动生成具体代码修改建议，但不参与本门禁。`;
}

function validateDescription(body, { requireSelectedType = true } = {}) {
  let previousIndex = -1;
  for (const heading of REQUIRED_HEADINGS) {
    const first = body.indexOf(heading);
    if (first === -1 || first <= previousIndex || body.indexOf(heading, first + heading.length) !== -1) {
      throw new Error(`PR 描述缺少、重复或乱序章节：${heading}`);
    }
    previousIndex = first;
  }

  for (const prefix of REQUIRED_FIELD_PREFIXES) {
    if (!new RegExp(`^\\s*- ${escapeRegExp(prefix)}`, "mu").test(body)) {
      throw new Error(`PR 描述缺少模板字段：${prefix}`);
    }
  }

  for (const type of ["Feature", "Refactor", "Bugfix", "文档 / 注释 / 依赖维护 / CI 配置等简单改动"]) {
    if (!new RegExp(`^- \\[[ xX]\\] ${escapeRegExp(type)}$`, "mu").test(body)) {
      throw new Error(`PR 描述缺少 PR 类型 checkbox：${type}`);
    }
  }
  if (
    requireSelectedType &&
    !/^- \[[xX]\] (?:Feature|Refactor|Bugfix|文档 \/ 注释 \/ 依赖维护 \/ CI 配置等简单改动)$/mu.test(body)
  ) {
    throw new Error("PR 描述必须至少选择一种 PR 类型");
  }

  const selfTest = getSection(body, "## 自测情况");
  if (!/^\s*- 不涉及\s*$/mu.test(selfTest)) {
    for (const pattern of [
      /^- \[ \] \*\*T1[：:].+\*\*$/mu,
      /^\s+- 操作步骤：.+$/mu,
      /^\s+- 预期结果：.+$/mu,
      /^\s+- 关注点：.+$/mu,
      /^\s+- 实际结果 \/ 备注：/mu,
    ]) {
      if (!pattern.test(selfTest)) throw new Error("PR 描述中的自测用例结构不完整");
    }
  }

  const retrospective = getSection(body, "## 复盘与改进");
  if (
    (retrospective.match(/^\s+- \[[ xX]\] 是$/gmu) ?? []).length !== 2 ||
    (retrospective.match(/^\s+- \[[ xX]\] 否$/gmu) ?? []).length !== 2
  ) {
    throw new Error("PR 描述中的复盘 checkbox 结构不完整");
  }
  return true;
}

function trimGeneratedWrapper(body = "") {
  const firstHeading = body.indexOf(REQUIRED_HEADINGS[0]);
  if (firstHeading === -1) {
    throw new Error("PR-Agent 生成结果未包含 PR 模板起始章节");
  }

  return body
    .slice(firstHeading)
    .replace(/\n+_{3,}\s*$/u, "")
    .trim();
}

function getSection(body, heading) {
  const start = body.indexOf(heading);
  if (start === -1) return null;
  const next = body.indexOf("\n## ", start + heading.length);
  return body.slice(start, next === -1 ? body.length : next).trimEnd();
}

function replaceSection(body, heading, replacement) {
  const current = getSection(body, heading);
  if (!current || !replacement) return body;
  return body.replace(current, replacement);
}

function preserveActualResults(generated, previous) {
  const resultLine = /^(\s*- 实际结果 \/ 备注：)(.*)$/gmu;
  const previousValues = [...previous.matchAll(resultLine)].map((match) => match[2]);
  let index = 0;
  return generated.replace(resultLine, (line, prefix, value) => {
    const previousValue = previousValues[index++];
    return previousValue?.trim() ? `${prefix}${previousValue}` : `${prefix}${value}`;
  });
}

function preserveScreenshots(generated, previous) {
  const screenshots = previous.split("\n").filter((line) => /^\s*(?:!\[[^\]]*\]\([^)]+\)|<img\b[^>]*>)/u.test(line));
  if (screenshots.length === 0 || screenshots.every((line) => generated.includes(line))) return generated;

  const uiField = /^- 是否涉及 UI 改动，如果有补充截图.*$/mu;
  return generated.replace(uiField, (line) => `${line}\n\n${screenshots.join("\n")}`);
}

function normalizeDescription(generatedBody, previousBody = "") {
  let normalized = trimGeneratedWrapper(generatedBody);
  validateDescription(normalized);

  try {
    const previous = trimGeneratedWrapper(previousBody);
    validateDescription(previous, { requireSelectedType: false });
    for (const heading of ["## 关联信息", "## 复盘与改进"]) {
      normalized = replaceSection(normalized, heading, getSection(previous, heading));
    }
    normalized = preserveActualResults(normalized, previous);
    normalized = preserveScreenshots(normalized, previous);
  } catch {
    // The initial PR body may be empty; in that case the generated template is authoritative.
  }

  validateDescription(normalized);
  return `${normalized.trim()}\n`;
}

function stripImproveHistory(body) {
  const historyIndex = body.indexOf("#### Previous suggestions");
  if (historyIndex === -1) return body;
  return body
    .slice(0, historyIndex)
    .replace(/\n+___\s*$/u, "")
    .trimEnd();
}

function selectLatestComments(comments, header) {
  return comments
    .filter((comment) => comment.user?.type === "Bot" && comment.body?.startsWith(header))
    .sort((left, right) => {
      const time = Date.parse(right.updated_at) - Date.parse(left.updated_at);
      return time || right.id - left.id;
    });
}

async function listComments(github, context, issueNumber) {
  return github.paginate(github.rest.issues.listComments, {
    ...context.repo,
    issue_number: issueNumber,
    per_page: 100,
  });
}

async function getPullRequest(github, context, pullNumber = getPrNumber(context)) {
  const { data } = await github.rest.pulls.get({ ...context.repo, pull_number: pullNumber });
  return data;
}

async function findStateComment(github, context, issueNumber) {
  const comments = await listComments(github, context, issueNumber);
  const stateComments = comments
    .filter(
      (comment) =>
        comment.user?.type === "Bot" && (decodeState(comment.body) || comment.body?.startsWith(STATE_HEADING)),
    )
    .sort((left, right) => right.id - left.id);

  for (const duplicate of stateComments.slice(1)) {
    await github.rest.issues.deleteComment({ ...context.repo, comment_id: duplicate.id });
  }
  return stateComments[0] ?? null;
}

async function saveState(github, context, pullRequest, state, existingComment = null, { recreate = false } = {}) {
  const body = renderState(state, pullRequest);
  const comment = existingComment ?? (await findStateComment(github, context, pullRequest.number));
  if (comment) {
    if (recreate) {
      const { data } = await github.rest.issues.createComment({
        ...context.repo,
        issue_number: pullRequest.number,
        body,
      });
      await github.rest.issues.deleteComment({ ...context.repo, comment_id: comment.id });
      return data;
    }

    if (comment.body === body) return comment;

    const { data } = await github.rest.issues.updateComment({
      ...context.repo,
      comment_id: comment.id,
      body,
    });
    return data;
  }

  const { data } = await github.rest.issues.createComment({
    ...context.repo,
    issue_number: pullRequest.number,
    body,
  });
  return data;
}

async function prepare({ github, context, core }) {
  const pullNumber = getPrNumber(context);
  if (!pullNumber) throw new Error("当前事件未关联 Pull Request");

  const pullRequest = await getPullRequest(github, context, pullNumber);
  const comments = await listComments(github, context, pullNumber);
  const stateComment = comments
    .filter((comment) => comment.user?.type === "Bot" && decodeState(comment.body))
    .sort((left, right) => right.id - left.id)[0];
  const state = decodeState(stateComment?.body);
  const humanReviewStarted = Boolean(state?.humanReviewStarted) || hasHumanReviewRoutingState(pullRequest);
  const tool = getTool(context.eventName, context.payload, { humanReviewStarted });
  const snapshotPath = path.join(process.env.RUNNER_TEMP, `pr-agent-body-${pullNumber}.md`);
  const commentsSnapshotPath = path.join(process.env.RUNNER_TEMP, `pr-agent-comments-${pullNumber}.json`);
  fs.writeFileSync(snapshotPath, pullRequest.body ?? "", "utf8");
  const aiComments = comments
    .filter(
      (comment) =>
        comment.user?.type === "Bot" &&
        (comment.body?.startsWith(REVIEW_HEADER) || comment.body?.startsWith(IMPROVE_HEADER)),
    )
    .map(({ body, id, updated_at }) => ({ body, id, updated_at }));
  fs.writeFileSync(commentsSnapshotPath, JSON.stringify(aiComments), "utf8");

  core.setOutput("pr_number", String(pullNumber));
  core.setOutput("tool", tool);
  core.setOutput("run_agent", String(Boolean(tool)));
  core.setOutput("auto_describe", String(tool === "automatic"));
  core.setOutput("normalize_description", String(tool === "automatic" || tool === "describe"));
  core.setOutput("cleanup_kind", getCleanupKind(tool));
  core.setOutput("snapshot_path", snapshotPath);
  core.setOutput("comments_snapshot_path", commentsSnapshotPath);
}

async function normalizePullDescription({ github, context, core }) {
  const pullRequest = await getPullRequest(github, context);
  const snapshotPath = process.env.SNAPSHOT_PATH;
  const previousBody = fs.readFileSync(snapshotPath, "utf8");

  try {
    const body = normalizeDescription(pullRequest.body ?? "", previousBody);
    if (body !== pullRequest.body) {
      await github.rest.pulls.update({ ...context.repo, pull_number: pullRequest.number, body });
    }
  } catch (error) {
    if ((pullRequest.body ?? "") !== previousBody) {
      await github.rest.pulls.update({ ...context.repo, pull_number: pullRequest.number, body: previousBody });
    }
    core.setFailed(error.message);
  }
}

async function cleanupAiComments({ github, context, core }) {
  const kind = process.env.CLEANUP_KIND;
  if (!kind) return;

  const pullNumber = getPrNumber(context);
  const comments = await listComments(github, context, pullNumber);
  const header = kind === "review" ? REVIEW_HEADER : IMPROVE_HEADER;
  const matching = selectLatestComments(comments, header);
  if (matching.length === 0) {
    core.setFailed(`PR-Agent 未发布最新的 ${kind} 结果评论`);
    return;
  }

  const previousComments = JSON.parse(fs.readFileSync(process.env.COMMENTS_SNAPSHOT_PATH, "utf8"));
  const previousById = new Map(previousComments.map((comment) => [comment.id, comment]));
  const hasFreshResult = matching.some((comment) => {
    const previous = previousById.get(comment.id);
    return !previous || previous.body !== comment.body || previous.updated_at !== comment.updated_at;
  });
  if (!hasFreshResult) {
    core.setFailed(`PR-Agent 未更新本轮 ${kind} 结果，拒绝复用旧评论`);
    return;
  }

  const [latest, ...outdated] = matching;
  if (kind === "improve") {
    const body = stripImproveHistory(latest.body);
    if (body !== latest.body) {
      await github.rest.issues.updateComment({ ...context.repo, comment_id: latest.id, body });
    }
  }

  for (const comment of outdated) {
    await github.rest.issues.deleteComment({ ...context.repo, comment_id: comment.id });
  }
}

function applyRunResult(stateInput, result) {
  const state = { ...stateInput };
  const agentSucceeded = result.agentOutcome === "success";
  const cleanupSucceeded = !result.cleanupKind || result.cleanupOutcome === "success";
  const normalizeSucceeded = result.normalizeOutcome === "success";

  const isReview = result.tool === "automatic" || result.tool === "automatic_review" || result.tool === "review";
  if (isReview && agentSucceeded && cleanupSucceeded) {
    state.reviewHeadSha = result.headSha;
    state.reviewRunId = result.runId;
    if (!state.humanReviewStarted) {
      state.acknowledgedReviewRunId = null;
      state.acknowledgedBy = null;
    }
  } else if (isReview && agentSucceeded) {
    // The review comment may already have changed before cleanup failed. Require a fresh acknowledgement.
    if (!state.humanReviewStarted) {
      state.acknowledgedReviewRunId = null;
      state.acknowledgedBy = null;
    }
  }

  if (result.tool === "automatic" || result.tool === "describe") {
    state.descriptionValid = normalizeSucceeded;
  }

  if (!agentSucceeded && result.tool) {
    state.lastRunError = `\`${result.tool}\` 调用失败`;
  } else if (!cleanupSucceeded) {
    state.lastRunError = `\`${result.tool}\` 结果校验或清理失败`;
  } else if ((result.tool === "automatic" || result.tool === "describe") && !normalizeSucceeded) {
    state.lastRunError = "PR 描述格式校验失败，已恢复原描述";
  } else if (result.tool) {
    state.lastRunError = null;
  }

  return state;
}

function shouldRecreateStateComment(result) {
  const isReview = result.tool === "automatic" || result.tool === "automatic_review" || result.tool === "review";
  const cleanupSucceeded = !result.cleanupKind || result.cleanupOutcome === "success";
  return isReview && result.agentOutcome === "success" && cleanupSucceeded;
}

async function updateStateAfterRun({ github, context }) {
  const pullRequest = await getPullRequest(github, context);
  const existing = await findStateComment(github, context, pullRequest.number);
  const result = {
    tool: process.env.TOOL,
    headSha: pullRequest.head.sha,
    runId: process.env.RUN_ID,
    agentOutcome: process.env.AGENT_OUTCOME,
    normalizeOutcome: process.env.NORMALIZE_OUTCOME,
    cleanupKind: process.env.CLEANUP_KIND,
    cleanupOutcome: process.env.CLEANUP_OUTCOME,
  };
  const state = applyRunResult(decodeState(existing?.body) ?? createState(), result);

  await saveState(github, context, pullRequest, state, existing, {
    recreate: shouldRecreateStateComment(result),
  });
}

function eventCheckboxChecked(payload) {
  return new RegExp(`^- \\[x\\] ${escapeRegExp(ACK_TEXT)}$`, "mu").test(payload.comment?.body ?? "");
}

function applyAcknowledgementInput(stateInput, pullRequest, actor, checked) {
  const state = { ...stateInput };
  if (actor !== pullRequest.user.login) return state;

  if (checked && isReviewCurrent(state, pullRequest.head.sha) && state.descriptionValid) {
    state.acknowledgedReviewRunId = state.reviewRunId;
    state.acknowledgedBy = actor;
  } else {
    state.acknowledgedReviewRunId = null;
    state.acknowledgedBy = null;
  }
  return state;
}

async function applyAcknowledgement(github, context, pullRequest, state, stateComment) {
  const isGateEdit =
    context.eventName === "issue_comment" &&
    context.payload.action === "edited" &&
    context.payload.comment?.id === stateComment?.id &&
    decodeState(context.payload.comment?.body);
  if (!isGateEdit) return state;
  return applyAcknowledgementInput(state, pullRequest, context.actor, eventCheckboxChecked(context.payload));
}

async function convertPullRequestToDraft({ github, context }) {
  const pullRequest = await getPullRequest(github, context);
  if (pullRequest.draft) return;

  await github.graphql(
    `mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
      convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
        pullRequest { isDraft }
      }
    }`,
    { pullRequestId: pullRequest.node_id },
  );
}

async function evaluateGate({ github, context, core }) {
  const pullRequest = await getPullRequest(github, context);
  const existing = await findStateComment(github, context, pullRequest.number);
  let state = decodeState(existing?.body) ?? createState();
  if (hasHumanReviewRoutingState(pullRequest)) state.humanReviewStarted = true;
  state = await applyAcknowledgement(github, context, pullRequest, state, existing);

  if (!state.humanReviewStarted && !isReviewCurrent(state, pullRequest.head.sha)) {
    state.acknowledgedReviewRunId = null;
    state.acknowledgedBy = null;
  }

  await saveState(github, context, pullRequest, state, existing);
  const eligible = isEligible(state, pullRequest);
  core.setOutput("eligible", String(eligible));
  core.setOutput("needs_draft", String(!eligible && !pullRequest.draft));

  const failedSteps = [
    ["PR-Agent", process.env.AGENT_OUTCOME, process.env.RUN_AGENT === "true"],
    ["PR 描述规范化", process.env.NORMALIZE_OUTCOME, process.env.NORMALIZE_DESCRIPTION === "true"],
    ["AI 评论清理", process.env.CLEANUP_OUTCOME, Boolean(process.env.CLEANUP_KIND)],
    ["门禁状态更新", process.env.STATE_OUTCOME, true],
  ].filter(([, outcome, relevant]) => relevant && outcome === "failure");
  if (failedSteps.length > 0) {
    core.setFailed(failedSteps.map(([stepName]) => `${stepName}执行失败`).join("；"));
  }
}

module.exports = {
  ACK_TEXT,
  IMPROVE_HEADER,
  REQUIRED_HEADINGS,
  REVIEW_HEADER,
  STATE_HEADING,
  applyAcknowledgementInput,
  applyRunResult,
  cleanupAiComments,
  convertPullRequestToDraft,
  createState,
  decodeState,
  encodeState,
  evaluateGate,
  eventCheckboxChecked,
  getTool,
  getCleanupKind,
  isAcknowledged,
  isEligible,
  isReviewCurrent,
  normalizeDescription,
  normalizePullDescription,
  prepare,
  renderState,
  selectLatestComments,
  shouldRecreateStateComment,
  stripImproveHistory,
  updateStateAfterRun,
  validateDescription,
};
