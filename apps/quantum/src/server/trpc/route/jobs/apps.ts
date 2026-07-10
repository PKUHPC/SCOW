import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { AppServiceClient, WebAppProps_ProxyType } from "@scow/protos/build/portal/app";
import { calculateAppRemainingTime } from "src/models/job";
import { quantumConfig } from "src/server/config/quantum";
import { procedure } from "src/server/trpc/procedure/base";
import { checkClusterAvailable, getAdapterClient, getCurrentClusters } from "src/server/utils/clusters";
import { logger } from "src/server/utils/logger";
import { paginate, paginationSchema } from "src/server/utils/pagination";
import { getPortalClient } from "src/utils/client";
import { isWebAppReachableThroughPortalProxy } from "src/utils/portalProxyReachability";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { booleanQueryParam } from "../utils";

const AppSessionSchema = z.object({
  sessionId: z.string(),
  jobName: z.string(),
  jobId: z.number(),
  submitTime: z.string().optional(),
  appId: z.string(),
  appName: z.string().optional(),
  state: z.string(),
  dataPath: z.string(),
  runningTime: z.string(),
  timeLimit: z.string(),
  reason: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  user: z.string().optional(),
  proxyServer: z.string().optional(),
  appType: z.string().optional(),
  connectPath: z.string().optional(),
});

export type AppSession = z.infer<typeof AppSessionSchema>;

export const listAppSessions = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions",
      tags: ["appSessions"],
      summary: "List APP Sessions",
    },
  })
  .input(
    z.object({
      isRunning: booleanQueryParam().optional(),
      ...paginationSchema.shape,
    }),
  )
  .output(z.object({ sessions: z.array(AppSessionSchema) }))
  .query(async ({ input, ctx: { user } }) => {
    if (USE_MOCK || process.env.NODE_ENV === "development") {
      return { sessions: [], count: 0 };
    }

    const { page, pageSize } = input;

    const { cluster, appId } = quantumConfig.jupyter;

    const userId = user.identityId;

    const client = getPortalClient(AppServiceClient);

    const jobsInfo = await asyncUnaryCall(client, "listAppSessions", {
      clusters: [cluster],
      userId,
    })
      .then((reply) => {
        return reply.sessions;
      })
      .catch((e) => {
        throw e;
      });

    const filteredSessions = jobsInfo
      .filter((x) => x.appId === appId)
      .map((x) => ({
        ...x,
        jobName: x.jobName ? x.jobName : x.sessionId,
        remainingTime:
          x.state === "RUNNING"
            ? calculateAppRemainingTime(x.runningTime, x.timeLimit)
            : x.state === "PENDING"
              ? ""
              : x.timeLimit,
      }));

    const { paginatedItems: paginatedSessions, totalCount } = paginate(filteredSessions, page, pageSize);

    return { sessions: paginatedSessions, count: totalCount };
  });

export const getQuantumConfig = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/getQuantumConfig",
      tags: ["getQuantumConfig"],
      summary: "Get Quantum Config",
    },
  })
  .input(z.void())
  .output(
    z.object({
      appId: z.string(),
      cluster: z.string(),
    }),
  )
  .query(async () => {
    return quantumConfig.jupyter;
  });

const TIMEOUT_MS = 3000;

const getWebAppConnectionInfo = async ({
  cluster,
  userId,
  sessionId,
  jobId,
}: {
  cluster: string;
  userId: string;
  sessionId: string;
  jobId: number;
}) => {
  const client = getPortalClient(AppServiceClient);

  const reply = await asyncUnaryCall(client, "connectToApp", {
    cluster,
    userId,
    sessionId,
    jobId,
  });

  if (reply.appProps?.$case !== "web") {
    logger.warn(
      {
        cluster,
        userId,
        sessionId,
        jobId,
        appPropsCase: reply.appProps?.$case,
      },
      "Portal returned a non-web app session when connecting quantum Jupyter app.",
    );
    throw new Error(`session id ${sessionId} is not a web app session`);
  }

  const webProps = reply.appProps.web;

  return {
    host: reply.host,
    port: reply.port,
    password: reply.password,
    type: "web" as const,
    connect: {
      method: webProps.method,
      path: webProps.path,
      query: webProps.query ?? {},
      formData: webProps.formData ?? {},
    },
    proxyType: webProps.proxyType === WebAppProps_ProxyType.RELATIVE ? ("relative" as const) : ("absolute" as const),
    customFormData: webProps.customFormData,
  };
};

export const checkAppConnectivity = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions/{jobId}/checkConnectivity",
      tags: ["appSessions"],
      summary: "Check APP Session Connectivity",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      sessionId: z.string(),
      jobId: z.number(),
    }),
  )
  .output(
    z.object({
      ok: z.boolean(),
    }),
  )
  .query(async ({ input, ctx: { req, user } }) => {
    const { jobId, clusterId, sessionId } = input;

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, clusterId);

    try {
      const connectionInfo = await getWebAppConnectionInfo({
        cluster: clusterId,
        userId: user.identityId,
        sessionId,
        jobId,
      });

      const reachable = await isWebAppReachableThroughPortalProxy({
        req,
        timeout: TIMEOUT_MS,
        clusterId,
        host: connectionInfo.host,
        port: connectionInfo.port,
        proxyType: connectionInfo.proxyType,
      });

      return { ok: reachable };
    } catch (e) {
      logger.warn(
        { err: e, clusterId, sessionId, jobId, userId: user.identityId },
        "Failed to check quantum Jupyter app connectivity.",
      );
      return { ok: false };
    }
  });

export const connectToApp = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/connectToApp",
      tags: ["connectToApp"],
      summary: "Connect To App",
    },
  })
  .input(
    z.object({
      cluster: z.string(),
      sessionId: z.string(),
      jobId: z.number(),
    }),
  )
  .output(
    z.object({
      host: z.string(),
      port: z.number(),
      password: z.string().optional(),
      type: z.literal("web"),
      connect: z.object({
        method: z.string(),
        path: z.string(),
        query: z.record(z.string(), z.string()).optional(),
        formData: z.record(z.string(), z.string()).optional(),
      }),
      proxyType: z.union([z.literal("relative"), z.literal("absolute")]),
      customFormData: z.record(z.string(), z.string()).optional(),
    }),
  )
  .mutation(async ({ input, ctx: { user } }) => {
    const { cluster, sessionId, jobId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    return await getWebAppConnectionInfo({ cluster, userId, sessionId, jobId });
  });

export const cancelJob = procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/jobs/{jobId}",
      tags: ["jobs"],
      summary: "Cancel Train Job or App Session",
    },
  })
  .input(
    z.object({
      cluster: z.string(),
      jobId: z.number(),
    }),
  )
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {
    const { cluster, jobId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    const client = getAdapterClient(cluster);
    await asyncUnaryCall(client.job, "cancelJob", {
      userId,
      jobId,
    });
  });
