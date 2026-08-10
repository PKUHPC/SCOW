const { decodeState, isEligible, renderState } = require("./pr-agent-workflow.cjs");

const STAGES = [
  { name: "Code1", reviewers: ["piccaSun"] },
  {
    name: "Code2",
    reviewers: ["283713406"],
    matches: (files) =>
      files.some((file) => file.startsWith("apps/scow-adapters/") || file.startsWith("libs/protos/scheduler-adapter/")),
  },
  { name: "Code3", reviewers: ["Miracle575"] },
];
const E2E_STAGE = { name: "E2E", reviewers: ["lyl-available"] };
const STATUS_SUFFIX = {
  approved: "Approved",
  changesRequested: "ChangeRequested",
  requested: "ReviewRequested",
  skipped: "Skipped",
};
const READY_LABEL = "ReadyForMerge";
const MANAGED_LABELS = new Set([
  READY_LABEL,
  ...[...STAGES, E2E_STAGE].flatMap((stage) => Object.values(STATUS_SUFFIX).map((suffix) => `${stage.name}-${suffix}`)),
]);

function latestDecisions(reviews) {
  const decisions = new Map();
  const decisiveStates = new Set(["APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);
  for (const review of [...reviews].sort((left, right) => left.id - right.id)) {
    if (decisiveStates.has(review.state)) decisions.set(review.user.login, review.state);
  }
  return decisions;
}

function getStageStatus(stage, { author, decisions, requestedReviewers }) {
  const eligibleReviewers = stage.reviewers.filter((reviewer) => reviewer !== author);
  if (eligibleReviewers.length === 0) return "skipped";
  if (eligibleReviewers.some((reviewer) => requestedReviewers.has(reviewer))) return "requested";
  if (eligibleReviewers.some((reviewer) => decisions.get(reviewer) === "APPROVED")) return "approved";
  if (eligibleReviewers.some((reviewer) => decisions.get(reviewer) === "CHANGES_REQUESTED")) {
    return "changesRequested";
  }
  return "pending";
}

function isSatisfied(stageStatus) {
  return stageStatus === "approved" || stageStatus === "skipped";
}

function statusLabel(stage, stageStatus) {
  return STATUS_SUFFIX[stageStatus] ? `${stage.name}-${STATUS_SUFFIX[stageStatus]}` : null;
}

function buildRoutingPlan({ author, autoRequest = true, files, labels, requestedReviewers, reviews }) {
  const decisions = latestDecisions(reviews);
  const mainStages = STAGES.filter((stage) => !stage.matches || stage.matches(files));
  const reviewersToRequest = new Set();
  const desiredLabels = new Set();
  const statuses = new Map();
  let previousStagesSatisfied = true;

  for (const stage of mainStages) {
    let stageStatus = getStageStatus(stage, { author, decisions, requestedReviewers });
    if (stageStatus === "pending" && previousStagesSatisfied && autoRequest) {
      stageStatus = "requested";
      for (const reviewer of stage.reviewers) {
        if (reviewer !== author && !requestedReviewers.has(reviewer)) reviewersToRequest.add(reviewer);
      }
    }

    statuses.set(stage.name, stageStatus);
    const label = statusLabel(stage, stageStatus);
    if (label) desiredLabels.add(label);
    if (!isSatisfied(stageStatus)) previousStagesSatisfied = false;
  }

  const e2eActive =
    E2E_STAGE.reviewers.some((reviewer) => requestedReviewers.has(reviewer) || decisions.has(reviewer)) ||
    [...labels].some((label) => label.startsWith("E2E-"));
  if (e2eActive) {
    let stageStatus = getStageStatus(E2E_STAGE, { author, decisions, requestedReviewers });
    if (stageStatus === "pending" && previousStagesSatisfied && autoRequest) {
      stageStatus = "requested";
      for (const reviewer of E2E_STAGE.reviewers) {
        if (reviewer !== author && !requestedReviewers.has(reviewer)) reviewersToRequest.add(reviewer);
      }
    }
    statuses.set(E2E_STAGE.name, stageStatus);
    const label = statusLabel(E2E_STAGE, stageStatus);
    if (label) desiredLabels.add(label);
  }

  const mainStagesApproved = mainStages.every((stage) => isSatisfied(statuses.get(stage.name)));
  const e2eApproved = !e2eActive || isSatisfied(statuses.get(E2E_STAGE.name));
  if (mainStagesApproved && e2eApproved) desiredLabels.add(READY_LABEL);

  return {
    desiredLabels: [...desiredLabels],
    reviewersToRequest: [...reviewersToRequest],
    statuses: Object.fromEntries(statuses),
  };
}

function shouldAllowStart(context) {
  if (
    context.eventName === "pull_request_target" &&
    ["ready_for_review", "reopened"].includes(context.payload.action)
  ) {
    return true;
  }

  if (
    context.eventName === "issue_comment" &&
    ["created", "edited"].includes(context.payload.action)
  ) {
    const state = decodeState(context.payload.comment?.body);
    return Boolean(state && !state.humanReviewStarted);
  }

  return false;
}

async function listComments(github, context, issueNumber) {
  return github.paginate(github.rest.issues.listComments, {
    ...context.repo,
    issue_number: issueNumber,
    per_page: 100,
  });
}

async function getAiGate(github, context, pullRequest) {
  const comments = await listComments(github, context, pullRequest.number);
  const gateComment = comments
    .filter((comment) => comment.user?.type === "Bot" && decodeState(comment.body))
    .sort((left, right) => right.id - left.id)[0];
  if (!gateComment) return null;
  const state = decodeState(gateComment.body);
  return { comment: gateComment, eligible: isEligible(state, pullRequest), state };
}

async function markHumanReviewStarted(github, context, pullRequest, gate) {
  if (!gate || gate.state.humanReviewStarted) return gate;
  const state = { ...gate.state, humanReviewStarted: true };
  const body = renderState(state, pullRequest);
  if (body !== gate.comment.body) {
    await github.rest.issues.updateComment({
      ...context.repo,
      comment_id: gate.comment.id,
      body,
    });
  }
  return { ...gate, eligible: true, state };
}

async function syncLabels(github, context, pullRequest, desiredLabels) {
  const currentLabels = new Set(pullRequest.labels.map((label) => label.name));
  const desired = new Set(desiredLabels);
  const labelsToAdd = [...desired].filter((label) => !currentLabels.has(label));
  const labelsToRemove = [...currentLabels].filter((label) => MANAGED_LABELS.has(label) && !desired.has(label));

  if (labelsToAdd.length > 0) {
    const repositoryLabels = await github.paginate(github.rest.issues.listLabelsForRepo, {
      ...context.repo,
      per_page: 100,
    });
    const existingRepositoryLabels = new Set(repositoryLabels.map((label) => label.name));
    for (const label of labelsToAdd.filter((label) => !existingRepositoryLabels.has(label))) {
      try {
        await github.rest.issues.createLabel({
          ...context.repo,
          name: label,
          color: "ededed",
        });
      } catch (error) {
        // Another PR routing run may create the repository-wide label concurrently.
        if (error.status !== 422) throw error;
      }
    }
    await github.rest.issues.addLabels({
      ...context.repo,
      issue_number: pullRequest.number,
      labels: labelsToAdd,
    });
  }
  for (const label of labelsToRemove) {
    await github.rest.issues.removeLabel({
      ...context.repo,
      issue_number: pullRequest.number,
      name: label,
    });
  }
}

async function routeHumanReviewers({ github, context, core, allowStart = false }) {
  const pullNumber = context.payload.pull_request?.number ?? context.payload.issue?.number;
  if (!pullNumber) throw new Error("当前事件未关联 Pull Request");
  const { data: pullRequest } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pullNumber,
  });

  if (pullRequest.draft) {
    core.setOutput("routing_status", "draft");
    return;
  }

  const currentLabels = new Set(pullRequest.labels.map((label) => label.name));
  const hasRoutingState = [...currentLabels].some((label) => MANAGED_LABELS.has(label));
  let aiGate = await getAiGate(github, context, pullRequest);
  if (hasRoutingState) aiGate = await markHumanReviewStarted(github, context, pullRequest, aiGate);
  if (aiGate?.eligible === false || (!hasRoutingState && !(allowStart && aiGate?.eligible === true))) {
    core.setOutput("routing_status", "waiting-for-ai-gate");
    return;
  }

  if (context.eventName === "pull_request_target" && context.payload.action === "synchronize") {
    if (currentLabels.has(READY_LABEL)) {
      await github.rest.issues.removeLabel({
        ...context.repo,
        issue_number: pullRequest.number,
        name: READY_LABEL,
      });
    }
    core.setOutput("routing_status", "waiting-for-manual-rerequest");
    return;
  }

  const [files, reviews] = await Promise.all([
    github.paginate(github.rest.pulls.listFiles, {
      ...context.repo,
      pull_number: pullNumber,
      per_page: 100,
    }),
    github.paginate(github.rest.pulls.listReviews, {
      ...context.repo,
      pull_number: pullNumber,
      per_page: 100,
    }),
  ]);
  const requestedReviewers = new Set(pullRequest.requested_reviewers.map((reviewer) => reviewer.login));
  const plan = buildRoutingPlan({
    author: pullRequest.user.login,
    autoRequest: allowStart || (context.eventName === "pull_request_review" && context.payload.action === "submitted"),
    files: files.map((file) => file.filename),
    labels: currentLabels,
    requestedReviewers,
    reviews,
  });

  if (plan.reviewersToRequest.length > 0) {
    await github.rest.pulls.requestReviewers({
      ...context.repo,
      pull_number: pullNumber,
      reviewers: plan.reviewersToRequest,
    });
  }
  await syncLabels(github, context, pullRequest, plan.desiredLabels);
  if (allowStart) await markHumanReviewStarted(github, context, pullRequest, aiGate);
  core.setOutput("routing_status", plan.desiredLabels.includes(READY_LABEL) ? "ready" : "reviewing");
}

module.exports = {
  MANAGED_LABELS,
  buildRoutingPlan,
  latestDecisions,
  routeHumanReviewers,
  shouldAllowStart,
};
