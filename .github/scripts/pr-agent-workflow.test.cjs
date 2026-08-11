const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workflow = require("./pr-agent-workflow.cjs");

const HEAD_SHA = "1234567890abcdef1234567890abcdef12345678";

function pullRequest({ headSha = HEAD_SHA, author = "alice" } = {}) {
  return {
    head: { sha: headSha },
    user: { login: author },
  };
}

test("opened PRs run describe and review, while AI-stage pushes run review only", () => {
  assert.equal(workflow.getTool("pull_request_target", { action: "opened" }), "automatic");
  assert.equal(workflow.getTool("pull_request_target", { action: "synchronize" }), "automatic_review");
  assert.equal(workflow.getTool("pull_request_target", { action: "synchronize" }, { humanReviewStarted: true }), "");
  assert.equal(workflow.getTool("pull_request_target", { action: "ready_for_review" }), "");
});

test("automatic synchronize reviews use the same cleanup as manual reviews", () => {
  assert.equal(workflow.getCleanupKind("automatic"), "review");
  assert.equal(workflow.getCleanupKind("automatic_review"), "review");
  assert.equal(workflow.getCleanupKind("review"), "review");
  assert.equal(workflow.getCleanupKind("improve"), "improve");
  assert.equal(workflow.getCleanupKind("describe"), "");
});

test("synchronize auto-runs review without auto-regenerating the description", () => {
  const workflowDefinition = fs.readFileSync(".github/workflows/pr-agent.yaml", "utf8");

  assert.match(
    workflowDefinition,
    /github_action_config\.auto_describe: \$\{\{ steps\.prepare\.outputs\.auto_describe \}\}/,
  );
  assert.match(workflowDefinition, /github_action_config\.pr_actions: '\["opened", "synchronize"\]'/);
  assert.match(workflowDefinition, /config\.model: \$\{\{ vars\.PR_AGENT_MODEL \|\| 'gpt-5\.6-sol' \}\}/);
});

test("PR-Agent image is pulled through the CCRepo proxy", () => {
  const workflowDefinition = fs.readFileSync(".github/workflows/pr-agent.yaml", "utf8");
  const actionDefinition = fs.readFileSync(".github/actions/pr-agent/action.yaml", "utf8");
  const loginPosition = workflowDefinition.indexOf("uses: docker/login-action@v3.6.0");
  const pullPosition = workflowDefinition.indexOf(
    "run: docker pull ccrepo.pku.edu.cn/dockerhub/pragent/pr-agent:github_action",
  );
  const runPosition = workflowDefinition.indexOf("uses: ./.github/actions/pr-agent");

  assert.match(workflowDefinition, /uses: docker\/login-action@v3\.6\.0/);
  assert.match(workflowDefinition, /run: docker pull ccrepo\.pku\.edu\.cn\/dockerhub\/pragent\/pr-agent:github_action/);
  assert.match(workflowDefinition, /uses: \.\/\.github\/actions\/pr-agent/);
  assert.equal(loginPosition < pullPosition && pullPosition < runPosition, true);
  assert.doesNotMatch(workflowDefinition, /uses: docker:\/\/ccrepo\.pku\.edu\.cn/);
  assert.doesNotMatch(workflowDefinition, /uses: The-PR-Agent\/pr-agent@/);
  assert.match(actionDefinition, /image: docker:\/\/ccrepo\.pku\.edu\.cn\/dockerhub\/pragent\/pr-agent:github_action/);
});

test("only draft conversion steps use the dedicated user token", () => {
  const workflowDefinition = fs.readFileSync(".github/workflows/pr-agent.yaml", "utf8");
  const tokenReferences = workflowDefinition.match(/secrets\.PR_AGENT_DRAFT_GATE_TOKEN/g) ?? [];
  const conversionSteps = workflowDefinition.match(
    /- name: Convert PR to draft (?:before|after) AI[\s\S]*?github-token: \$\{\{ secrets\.PR_AGENT_DRAFT_GATE_TOKEN \}\}/g,
  );
  const preGatePosition = workflowDefinition.indexOf("- name: Evaluate draft gate before AI");
  const agentPosition = workflowDefinition.indexOf("- name: Run PR-Agent");
  const finalGatePosition = workflowDefinition.indexOf("- name: Evaluate final AI review gate");

  assert.equal(tokenReferences.length, 2);
  assert.equal(conversionSteps?.length, 2);
  assert.equal(preGatePosition < agentPosition && agentPosition < finalGatePosition, true);
});

test("only supported slash commands invoke PR-Agent", () => {
  const payload = (body) => ({ issue: { pull_request: {} }, comment: { body } });
  assert.equal(workflow.getTool("issue_comment", payload("/review")), "review");
  assert.equal(workflow.getTool("issue_comment", payload(" /IMPROVE ")), "improve");
  assert.equal(workflow.getTool("issue_comment", payload("/describe")), "describe");
  assert.equal(workflow.getTool("issue_comment", payload("/review --config.publish_output=false")), "");
  assert.equal(workflow.getTool("issue_comment", payload("please /review")), "");
  assert.equal(workflow.getTool("issue_comment", payload("/ask something")), "");
});

test("a successful review is tied to the current head and resets acknowledgement", () => {
  const state = {
    ...workflow.createState(),
    acknowledgedReviewRunId: "old-run",
    acknowledgedBy: "alice",
  };
  const result = workflow.applyRunResult(state, {
    tool: "review",
    headSha: HEAD_SHA,
    runId: "42",
    agentOutcome: "success",
    cleanupKind: "review",
    cleanupOutcome: "success",
    normalizeOutcome: "skipped",
  });

  assert.equal(result.reviewHeadSha, HEAD_SHA);
  assert.equal(result.reviewRunId, "42");
  assert.equal(result.acknowledgedReviewRunId, null);
  assert.equal(result.acknowledgedBy, null);
});

test("improve never changes review gate credentials", () => {
  const state = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
    acknowledgedReviewRunId: "42",
    acknowledgedBy: "alice",
  };
  const result = workflow.applyRunResult(state, {
    tool: "improve",
    headSha: "different",
    runId: "99",
    agentOutcome: "success",
    cleanupKind: "improve",
    cleanupOutcome: "success",
    normalizeOutcome: "skipped",
  });

  assert.equal(result.reviewHeadSha, state.reviewHeadSha);
  assert.equal(result.reviewRunId, state.reviewRunId);
  assert.equal(result.acknowledgedReviewRunId, state.acknowledgedReviewRunId);
  assert.equal(result.acknowledgedBy, state.acknowledgedBy);
  assert.equal(workflow.isEligible(result, pullRequest()), true);
});

test("a failed rerun keeps the previous valid review and acknowledgement", () => {
  const state = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
    acknowledgedReviewRunId: "42",
    acknowledgedBy: "alice",
  };
  const result = workflow.applyRunResult(state, {
    tool: "review",
    headSha: HEAD_SHA,
    runId: "99",
    agentOutcome: "failure",
    cleanupKind: "review",
    cleanupOutcome: "skipped",
    normalizeOutcome: "skipped",
  });

  assert.equal(result.reviewRunId, "42");
  assert.equal(result.acknowledgedReviewRunId, "42");
  assert.match(result.lastRunError, /review/);
});

test("only a fully successful review recreates the gate comment", () => {
  const successfulReview = {
    tool: "review",
    agentOutcome: "success",
    cleanupKind: "review",
    cleanupOutcome: "success",
  };

  assert.equal(workflow.shouldRecreateStateComment(successfulReview), true);
  assert.equal(workflow.shouldRecreateStateComment({ ...successfulReview, tool: "automatic" }), true);
  assert.equal(workflow.shouldRecreateStateComment({ ...successfulReview, tool: "describe" }), false);
  assert.equal(workflow.shouldRecreateStateComment({ ...successfulReview, tool: "improve" }), false);
  assert.equal(workflow.shouldRecreateStateComment({ ...successfulReview, agentOutcome: "failure" }), false);
  assert.equal(workflow.shouldRecreateStateComment({ ...successfulReview, cleanupOutcome: "failure" }), false);
});

test("a successful review creates the latest gate before deleting the old gate", async () => {
  const testEnv = {
    TOOL: "review",
    RUN_ID: "99",
    AGENT_OUTCOME: "success",
    NORMALIZE_OUTCOME: "skipped",
    CLEANUP_KIND: "review",
    CLEANUP_OUTCOME: "success",
  };
  const previousEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, testEnv);
  const currentPullRequest = {
    ...pullRequest(),
    number: 1,
  };
  const oldState = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
  };
  const oldComment = {
    id: 1,
    user: { type: "Bot" },
    body: workflow.renderState(oldState, currentPullRequest),
  };
  const operations = [];
  const github = {
    paginate: async () => [oldComment],
    rest: {
      pulls: { get: async () => ({ data: currentPullRequest }) },
      issues: {
        listComments: {},
        createComment: async (input) => {
          operations.push({ kind: "create", input });
          return { data: { id: 2, ...input } };
        },
        deleteComment: async (input) => operations.push({ kind: "delete", input }),
        updateComment: async () => assert.fail("successful review should recreate the gate"),
      },
    },
  };

  await workflow.updateStateAfterRun({
    github,
    context: {
      repo: { owner: "PKUHPC", repo: "private-scow" },
      payload: { pull_request: { number: 1 } },
    },
  });

  assert.deepEqual(
    operations.map(({ kind }) => kind),
    ["create", "delete"],
  );
  assert.equal(workflow.decodeState(operations[0].input.body).reviewRunId, "99");
  assert.equal(operations[1].input.comment_id, 1);
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("a new head invalidates an otherwise complete gate state", () => {
  const state = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
    acknowledgedReviewRunId: "42",
    acknowledgedBy: "alice",
  };
  assert.equal(workflow.isEligible(state, pullRequest()), true);
  assert.equal(workflow.isEligible(state, pullRequest({ headSha: "new-head" })), false);
});

test("the initial AI gate remains complete after human review starts", () => {
  const state = {
    ...workflow.createState(),
    humanReviewStarted: true,
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
    acknowledgedReviewRunId: "42",
    acknowledgedBy: "alice",
  };
  const result = workflow.applyRunResult(state, {
    tool: "review",
    headSha: "new-head",
    runId: "99",
    agentOutcome: "success",
    cleanupKind: "review",
    cleanupOutcome: "success",
    normalizeOutcome: "skipped",
  });

  assert.equal(workflow.isEligible(result, pullRequest({ headSha: "another-head" })), true);
  assert.equal(result.acknowledgedReviewRunId, "42");
  assert.equal(result.acknowledgedBy, "alice");
  assert.match(workflow.renderState(result, pullRequest()), /初始 AI 门禁已完成/);
});

test("existing human review labels migrate an old gate state without returning the PR to draft", async () => {
  const currentPullRequest = {
    ...pullRequest({ headSha: "new-head" }),
    number: 1,
    node_id: "PR_node_id",
    draft: false,
    labels: [{ name: "Code1-ChangeRequested" }],
  };
  const oldState = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
    acknowledgedReviewRunId: "42",
    acknowledgedBy: "alice",
  };
  const stateComment = {
    id: 1,
    user: { type: "Bot" },
    body: workflow.renderState(oldState, currentPullRequest),
  };
  const outputs = {};
  const updatedComments = [];
  const github = {
    paginate: async () => [stateComment],
    rest: {
      pulls: { get: async () => ({ data: currentPullRequest }) },
      issues: {
        listComments: {},
        createComment: async () => assert.fail("state comment already exists"),
        updateComment: async (input) => updatedComments.push(input),
        deleteComment: async () => {},
      },
    },
  };

  await workflow.evaluateGate({
    github,
    context: {
      actor: "alice",
      eventName: "pull_request_target",
      repo: { owner: "PKUHPC", repo: "private-scow" },
      payload: { action: "synchronize", pull_request: { number: 1 } },
    },
    core: {
      setOutput: (outputName, value) => (outputs[outputName] = value),
      setFailed: assert.fail,
    },
  });

  assert.equal(outputs.eligible, "true");
  assert.equal(outputs.needs_draft, "false");
  assert.equal(workflow.decodeState(updatedComments[0].body).humanReviewStarted, true);
});

test("gate state marker round-trips and renders the manual commands", () => {
  const state = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
  };
  const body = workflow.renderState(state, pullRequest());
  assert.deepEqual(workflow.decodeState(body), state);
  assert.match(body, /`\/review`/);
  assert.match(body, /`\/describe`/);
  assert.match(body, /`\/improve`.*不参与本门禁/s);
  assert.match(body, /推送新提交后会自动执行 `\/review`/);
  assert.doesNotMatch(body, /推送新提交后，请评论 `\/review`/);
  assert.match(body, /先勾选上方确认框，再点击 \*\*Ready for review\*\*/);
  assert.match(body, /Draft PR 才会转为正式 PR/);
});

test("only the exact checked gate checkbox is accepted", () => {
  const payload = { comment: { body: `- [x] ${workflow.ACK_TEXT}` } };
  assert.equal(workflow.eventCheckboxChecked(payload), true);
  assert.equal(workflow.eventCheckboxChecked({ comment: { body: `- [ ] ${workflow.ACK_TEXT}` } }), false);
});

test("only the PR author can acknowledge the current review", () => {
  const state = {
    ...workflow.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
  };
  const ignored = workflow.applyAcknowledgementInput(state, pullRequest(), "bob", true);
  assert.equal(ignored.acknowledgedBy, null);

  const acknowledged = workflow.applyAcknowledgementInput(state, pullRequest(), "alice", true);
  assert.equal(acknowledged.acknowledgedBy, "alice");
  assert.equal(acknowledged.acknowledgedReviewRunId, "42");

  const unchecked = workflow.applyAcknowledgementInput(acknowledged, pullRequest(), "alice", false);
  assert.equal(unchecked.acknowledgedBy, null);
});

test("description normalization keeps the template and developer-owned content", () => {
  const template = fs.readFileSync(".github/PULL_REQUEST_TEMPLATE.md", "utf8");
  const previous = template
    .replace("- 需求 / Bug / PR 链接：", "- 需求 / Bug / PR 链接：https://example.test/task/1")
    .replace(
      "- 是否涉及 UI 改动，如果有补充截图",
      "- 是否涉及 UI 改动，如果有补充截图\n\n![界面](https://example.test/ui.png)",
    )
    .replace("- 实际结果 / 备注：", "- 实际结果 / 备注：人工验证通过")
    .replace("  - [ ] 是", "  - [x] 是");
  const generated = `### **Description**\n${template
    .replace("- [ ] 文档 / 注释 / 依赖维护 / CI 配置等简单改动", "- [x] 文档 / 注释 / 依赖维护 / CI 配置等简单改动")
    .replace("- 本次主要改动 / 修复内容：", "- 本次主要改动 / 修复内容：接入 PR-Agent")}\n___\n`;

  const normalized = workflow.normalizeDescription(generated, previous);
  workflow.validateDescription(normalized);
  assert.equal(normalized.startsWith("## PR 类型"), true);
  assert.match(normalized, /接入 PR-Agent/);
  assert.match(normalized, /https:\/\/example\.test\/task\/1/);
  assert.match(normalized, /!\[界面\]\(https:\/\/example\.test\/ui\.png\)/);
  assert.match(normalized, /实际结果 \/ 备注：人工验证通过/);
});

test("invalid or duplicate template sections are rejected", () => {
  assert.throws(() => workflow.normalizeDescription("## PR 类型\n内容"), /PR 描述缺少/);
  const template = fs.readFileSync(".github/PULL_REQUEST_TEMPLATE.md", "utf8");
  const selectedTemplate = template.replace("- [ ] Feature", "- [x] Feature");
  assert.throws(() => workflow.validateDescription(`${selectedTemplate}\n## PR 类型`), /重复或乱序/);
  assert.throws(
    () => workflow.validateDescription(selectedTemplate.replace("- 主要风险：", "- 被错误删除的字段：")),
    /缺少模板字段：主要风险/,
  );
  assert.throws(
    () => workflow.validateDescription(selectedTemplate.replace("- [x] Feature", "Feature")),
    /缺少 PR 类型 checkbox：Feature/,
  );
  assert.throws(() => workflow.validateDescription(template), /至少选择一种 PR 类型/);
});

test("improve history is removed and only the newest bot result is selected", () => {
  const body = `${workflow.IMPROVE_HEADER}\n\nlatest\n\n___\n\n#### Previous suggestions\nold`;
  assert.equal(workflow.stripImproveHistory(body), `${workflow.IMPROVE_HEADER}\n\nlatest`);

  const comments = [
    { id: 1, updated_at: "2026-01-01T00:00:00Z", user: { type: "Bot" }, body },
    { id: 2, updated_at: "2026-01-02T00:00:00Z", user: { type: "Bot" }, body },
    { id: 3, updated_at: "2026-01-03T00:00:00Z", user: { type: "User" }, body },
  ];
  assert.deepEqual(
    workflow.selectLatestComments(comments, workflow.IMPROVE_HEADER).map(({ id }) => id),
    [2, 1],
  );
});

test("cleanup keeps the latest improve result, removes its history, and deletes older bot results", async () => {
  const previousKind = process.env.CLEANUP_KIND;
  const previousSnapshotPath = process.env.COMMENTS_SNAPSHOT_PATH;
  process.env.CLEANUP_KIND = "improve";
  const updated = [];
  const deleted = [];
  const body = `${workflow.IMPROVE_HEADER}\n\nlatest\n\n___\n\n#### Previous suggestions\nold`;
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pr-agent-workflow-test-"));
  const snapshotPath = path.join(temporaryDirectory, "comments.json");
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify([{ id: 1, updated_at: "2026-01-01T00:00:00Z", user: { type: "Bot" }, body }]),
  );
  process.env.COMMENTS_SNAPSHOT_PATH = snapshotPath;
  const github = {
    paginate: async () => [
      { id: 1, updated_at: "2026-01-01T00:00:00Z", user: { type: "Bot" }, body },
      { id: 2, updated_at: "2026-01-02T00:00:00Z", user: { type: "Bot" }, body },
      { id: 3, updated_at: "2026-01-03T00:00:00Z", user: { type: "User" }, body },
    ],
    rest: {
      issues: {
        listComments: {},
        updateComment: async (input) => updated.push(input),
        deleteComment: async (input) => deleted.push(input),
      },
    },
  };
  const failures = [];

  await workflow.cleanupAiComments({
    github,
    context: { repo: { owner: "PKUHPC", repo: "private-scow" }, payload: { issue: { number: 1 } } },
    core: { setFailed: (message) => failures.push(message) },
  });

  assert.deepEqual(failures, []);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].comment_id, 2);
  assert.doesNotMatch(updated[0].body, /Previous suggestions/);
  assert.deepEqual(
    deleted.map(({ comment_id }) => comment_id),
    [1],
  );
  if (previousKind === undefined) delete process.env.CLEANUP_KIND;
  else process.env.CLEANUP_KIND = previousKind;
  if (previousSnapshotPath === undefined) delete process.env.COMMENTS_SNAPSHOT_PATH;
  else process.env.COMMENTS_SNAPSHOT_PATH = previousSnapshotPath;
  fs.rmSync(temporaryDirectory, { recursive: true });
});

test("gate converts an ineligible non-draft PR back to draft", async () => {
  const testEnv = {
    RUN_AGENT: "false",
    NORMALIZE_DESCRIPTION: "false",
    CLEANUP_KIND: "",
    AGENT_OUTCOME: "skipped",
    NORMALIZE_OUTCOME: "skipped",
    CLEANUP_OUTCOME: "skipped",
    STATE_OUTCOME: "success",
  };
  const previousEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, testEnv);
  const graphqlCalls = [];
  const createdComments = [];
  const github = {
    paginate: async () => [],
    graphql: async (...args) => graphqlCalls.push(args),
    rest: {
      pulls: {
        get: async () => ({
          data: {
            ...pullRequest(),
            number: 1,
            node_id: "PR_node_id",
            draft: false,
          },
        }),
      },
      issues: {
        listComments: {},
        createComment: async (input) => {
          createdComments.push(input);
          return { data: { id: 1, ...input } };
        },
        updateComment: async () => ({ data: {} }),
        deleteComment: async () => {},
      },
    },
  };
  const failures = [];
  const outputs = {};
  const context = {
    actor: "alice",
    eventName: "pull_request_target",
    repo: { owner: "PKUHPC", repo: "private-scow" },
    payload: { pull_request: { number: 1 } },
  };

  await workflow.evaluateGate({
    github,
    context,
    core: {
      setOutput: (outputName, value) => (outputs[outputName] = value),
      setFailed: (message) => failures.push(message),
    },
  });
  await workflow.convertPullRequestToDraft({ github, context });

  assert.equal(graphqlCalls.length, 1);
  assert.match(graphqlCalls[0][0], /convertPullRequestToDraft/);
  assert.equal(createdComments.length, 1);
  assert.equal(outputs.needs_draft, "true");
  assert.deepEqual(failures, []);
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("gate does not rewrite an unchanged state comment", async () => {
  const state = workflow.createState();
  const currentPullRequest = {
    ...pullRequest(),
    number: 1,
    node_id: "PR_node_id",
    draft: true,
  };
  const stateComment = {
    id: 1,
    user: { type: "Bot" },
    body: workflow.renderState(state, currentPullRequest),
  };
  const updatedComments = [];
  const github = {
    paginate: async () => [stateComment],
    graphql: async () => assert.fail("draft PR should not be converted"),
    rest: {
      pulls: { get: async () => ({ data: currentPullRequest }) },
      issues: {
        listComments: {},
        createComment: async () => assert.fail("state comment already exists"),
        updateComment: async (input) => updatedComments.push(input),
        deleteComment: async () => {},
      },
    },
  };

  await workflow.evaluateGate({
    github,
    context: {
      actor: "alice",
      eventName: "issue_comment",
      repo: { owner: "PKUHPC", repo: "private-scow" },
      payload: {
        action: "edited",
        issue: { number: 1 },
        comment: { id: 1, body: stateComment.body },
      },
    },
    core: { setOutput: () => {}, setFailed: assert.fail },
  });

  assert.deepEqual(updatedComments, []);
});
