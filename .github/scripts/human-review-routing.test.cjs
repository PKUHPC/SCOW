const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const routing = require("./human-review-routing.cjs");
const gate = require("./pr-agent-workflow.cjs");

const HEAD_SHA = "1234567890abcdef1234567890abcdef12345678";

function buildPlan(overrides = {}) {
  return routing.buildRoutingPlan({
    author: "alice",
    files: ["apps/portal-web/src/index.ts"],
    labels: new Set(),
    requestedReviewers: new Set(),
    reviews: [],
    ...overrides,
  });
}

function sorted(values) {
  return [...values].sort();
}

test("a formal review starts with Code1 only", () => {
  const plan = buildPlan();

  assert.deepEqual(plan.reviewersToRequest, ["piccaSun"]);
  assert.deepEqual(plan.desiredLabels, ["Code1-ReviewRequested"]);
});

test("Code1 approval advances directly to Code3 when Code2 paths are untouched", () => {
  const plan = buildPlan({
    reviews: [{ id: 1, state: "APPROVED", user: { login: "piccaSun" } }],
  });

  assert.deepEqual(plan.reviewersToRequest, ["Miracle575"]);
  assert.deepEqual(sorted(plan.desiredLabels), sorted(["Code1-Approved", "Code3-ReviewRequested"]));
});

test("matching adapter changes require Code2 before Code3", () => {
  const plan = buildPlan({
    files: ["apps/scow-adapters/pkg/ai/controller.go"],
    reviews: [{ id: 1, state: "APPROVED", user: { login: "piccaSun" } }],
  });

  assert.deepEqual(plan.reviewersToRequest, ["283713406"]);
  assert.deepEqual(sorted(plan.desiredLabels), sorted(["Code1-Approved", "Code2-ReviewRequested"]));
});

test("an already requested future reviewer keeps its label while Code2 is requested", () => {
  const plan = buildPlan({
    files: ["apps/scow-adapters/pkg/ai/controller.go"],
    requestedReviewers: new Set(["Miracle575"]),
    reviews: [{ id: 1, state: "APPROVED", user: { login: "piccaSun" } }],
  });

  assert.deepEqual(plan.reviewersToRequest, ["283713406"]);
  assert.deepEqual(
    sorted(plan.desiredLabels),
    sorted(["Code1-Approved", "Code2-ReviewRequested", "Code3-ReviewRequested"]),
  );
});

test("all required approvals add ReadyForMerge", () => {
  const plan = buildPlan({
    reviews: [
      { id: 1, state: "APPROVED", user: { login: "piccaSun" } },
      { id: 2, state: "APPROVED", user: { login: "Miracle575" } },
    ],
  });

  assert.deepEqual(plan.reviewersToRequest, []);
  assert.deepEqual(sorted(plan.desiredLabels), sorted(["Code1-Approved", "Code3-Approved", "ReadyForMerge"]));
});

test("a new manual review request overrides an earlier change request", () => {
  const reviews = [{ id: 1, state: "CHANGES_REQUESTED", user: { login: "piccaSun" } }];
  assert.deepEqual(buildPlan({ reviews }).desiredLabels, ["Code1-ChangeRequested"]);
  assert.deepEqual(buildPlan({ reviews, requestedReviewers: new Set(["piccaSun"]) }).desiredLabels, [
    "Code1-ReviewRequested",
  ]);
});

test("manual review routing events do not automatically request a pending reviewer", () => {
  const plan = buildPlan({
    autoRequest: false,
    labels: new Set(["Code1-ReviewRequested"]),
  });

  assert.deepEqual(plan.reviewersToRequest, []);
  assert.deepEqual(plan.desiredLabels, []);
});

test("the PR author is skipped when they are the configured reviewer", () => {
  const plan = buildPlan({ author: "piccaSun" });

  assert.deepEqual(plan.reviewersToRequest, ["Miracle575"]);
  assert.deepEqual(sorted(plan.desiredLabels), sorted(["Code1-Skipped", "Code3-ReviewRequested"]));
});

test("a future skipped stage is not labeled before the preceding review finishes", () => {
  const reviewingCode1 = buildPlan({ author: "Miracle575" });
  assert.deepEqual(reviewingCode1.reviewersToRequest, ["piccaSun"]);
  assert.deepEqual(reviewingCode1.desiredLabels, ["Code1-ReviewRequested"]);

  const code1Approved = buildPlan({
    author: "Miracle575",
    reviews: [{ id: 1, state: "APPROVED", user: { login: "piccaSun" } }],
  });
  assert.deepEqual(code1Approved.reviewersToRequest, []);
  assert.deepEqual(
    sorted(code1Approved.desiredLabels),
    sorted(["Code1-Approved", "Code3-Skipped", "ReadyForMerge"]),
  );
});

test("optional E2E blocks ReadyForMerge only after it is manually activated", () => {
  const reviews = [
    { id: 1, state: "APPROVED", user: { login: "piccaSun" } },
    { id: 2, state: "APPROVED", user: { login: "Miracle575" } },
  ];
  const requested = buildPlan({ reviews, requestedReviewers: new Set(["lyl-available"]) });
  assert.equal(requested.desiredLabels.includes("ReadyForMerge"), false);
  assert.equal(requested.desiredLabels.includes("E2E-ReviewRequested"), true);

  const approved = buildPlan({
    reviews: [...reviews, { id: 3, state: "APPROVED", user: { login: "lyl-available" } }],
  });
  assert.equal(approved.desiredLabels.includes("E2E-Approved"), true);
  assert.equal(approved.desiredLabels.includes("ReadyForMerge"), true);
});

test("the independent human workflow owns initial reviewer routing", () => {
  const prAgentWorkflow = fs.readFileSync(".github/workflows/pr-agent.yaml", "utf8");
  const routingWorkflow = fs.readFileSync(".github/workflows/human-review-routing.yaml", "utf8");

  assert.doesNotMatch(prAgentWorkflow, /Route human reviewers|routeHumanReviewers/);
  assert.match(routingWorkflow, /types: \[[^\]]*ready_for_review[^\]]*reopened/);
  assert.match(routingWorkflow, /issue_comment:/);
  assert.match(routingWorkflow, /types: \[created, edited\]/);
  assert.match(routingWorkflow, /workflow_dispatch:/);
  assert.match(routingWorkflow, /contains\(github\.event\.comment\.body, '<!-- scow-pr-agent-gate-state:'\)/);
  assert.doesNotMatch(routingWorkflow, /github\.event\.sender\.type == 'Bot'/);
  assert.doesNotMatch(routingWorkflow, /(?:types: \[|, )opened(?:,|\])/);
  assert.match(routingWorkflow, /routing\.shouldAllowStart\(context\)/);
  assert.match(routingWorkflow, /routeHumanReviewers\(\{ github, context, core, allowStart \}\)/);
  assert.equal(fs.existsSync(".github/pkuhpc-review-bot.yml"), false);
});

test("ordinary PR comments are ignored by human review routing", () => {
  assert.equal(
    routing.shouldHandleEvent({ eventName: "issue_comment", payload: { comment: { body: "/review" } } }),
    false,
  );
  assert.equal(
    routing.shouldHandleEvent({
      eventName: "issue_comment",
      payload: { comment: { body: gate.renderState(gate.createState(), { head: { sha: HEAD_SHA } }) } },
    }),
    true,
  );
  assert.equal(
    routing.shouldHandleEvent({
      eventName: "issue_comment",
      payload: {
        comment: {
          body: gate.renderState(
            { ...gate.createState(), humanReviewStarted: true },
            { head: { sha: HEAD_SHA } },
          ),
        },
      },
    }),
    false,
  );
});

test("manual reconciliation can start and request the current pending stage", () => {
  assert.equal(routing.shouldAllowStart({ eventName: "workflow_dispatch", payload: {} }), true);
});

test("an eligible AI gate comment can start routing for a formal PR", () => {
  const state = { ...gate.createState(), reviewHeadSha: HEAD_SHA, reviewRunId: "42" };
  assert.equal(
    routing.shouldAllowStart({
      eventName: "issue_comment",
      payload: { action: "edited", comment: { body: gate.renderState(state, { head: { sha: HEAD_SHA } }) } },
    }),
    true,
  );
  assert.equal(
    routing.shouldAllowStart({
      eventName: "issue_comment",
      payload: {
        action: "edited",
        comment: {
          body: gate.renderState({ ...state, humanReviewStarted: true }, { head: { sha: HEAD_SHA } }),
        },
      },
    }),
    false,
  );
});

test("only an eligible AI gate can start routing for a new formal PR", async () => {
  const pullRequest = {
    number: 1,
    draft: false,
    head: { sha: HEAD_SHA },
    user: { login: "alice" },
    labels: [],
    requested_reviewers: [],
  };
  const gateState = {
    ...gate.createState(),
    descriptionValid: true,
    reviewHeadSha: HEAD_SHA,
    reviewRunId: "42",
    acknowledgedReviewRunId: "42",
    acknowledgedBy: "alice",
  };
  const endpoints = {
    listComments: {},
    listFiles: {},
    listReviews: {},
    listLabelsForRepo: {},
  };
  const requested = [];
  const addedLabels = [];
  const updatedComments = [];
  const github = {
    paginate: async (endpoint) => {
      if (endpoint === endpoints.listComments) {
        return [{ id: 1, user: { type: "Bot" }, body: gate.renderState(gateState, pullRequest) }];
      }
      if (endpoint === endpoints.listFiles) return [{ filename: "apps/portal-web/src/index.ts" }];
      if (endpoint === endpoints.listReviews) return [];
      if (endpoint === endpoints.listLabelsForRepo) return [{ name: "Code1-ReviewRequested" }];
      assert.fail("unexpected pagination endpoint");
    },
    rest: {
      pulls: {
        get: async () => ({ data: pullRequest }),
        listFiles: endpoints.listFiles,
        listReviews: endpoints.listReviews,
        requestReviewers: async (input) => requested.push(input),
      },
      issues: {
        listComments: endpoints.listComments,
        listLabelsForRepo: endpoints.listLabelsForRepo,
        addLabels: async (input) => addedLabels.push(input),
        createLabel: async () => assert.fail("label already exists"),
        removeLabel: async () => {},
        updateComment: async (input) => updatedComments.push(input),
      },
    },
  };
  const context = {
    repo: { owner: "PKUHPC", repo: "private-scow" },
    payload: { pull_request: { number: 1 } },
  };

  await routing.routeHumanReviewers({
    github,
    context,
    core: { setOutput: () => {} },
  });
  assert.deepEqual(requested, []);

  await routing.routeHumanReviewers({
    github,
    context,
    core: { setOutput: () => {} },
    allowStart: true,
  });
  assert.deepEqual(requested[0].reviewers, ["piccaSun"]);
  assert.deepEqual(addedLabels[0].labels, ["Code1-ReviewRequested"]);
  assert.match(updatedComments[0].body, /初始 AI 门禁已完成/);
});

test("a push during human review only removes ReadyForMerge", async () => {
  const pullRequest = {
    number: 1,
    draft: false,
    head: { sha: HEAD_SHA },
    user: { login: "alice" },
    labels: [{ name: "Code1-Approved" }, { name: "Code3-Approved" }, { name: "ReadyForMerge" }],
    requested_reviewers: [],
  };
  const gateState = { ...gate.createState(), humanReviewStarted: true };
  const endpoints = { listComments: {} };
  const removedLabels = [];
  const github = {
    paginate: async (endpoint) => {
      assert.equal(endpoint, endpoints.listComments);
      return [{ id: 1, user: { type: "Bot" }, body: gate.renderState(gateState, pullRequest) }];
    },
    rest: {
      pulls: { get: async () => ({ data: pullRequest }) },
      issues: {
        listComments: endpoints.listComments,
        removeLabel: async (input) => removedLabels.push(input),
      },
    },
  };

  await routing.routeHumanReviewers({
    github,
    context: {
      eventName: "pull_request_target",
      repo: { owner: "PKUHPC", repo: "private-scow" },
      payload: { action: "synchronize", pull_request: { number: 1 } },
    },
    core: { setOutput: () => {} },
  });

  assert.deepEqual(
    removedLabels.map(({ name: labelName }) => labelName),
    ["ReadyForMerge"],
  );
});
