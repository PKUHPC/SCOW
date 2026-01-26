import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { normalizePathnameWithQuery } from "@scow/utils";
import { IncomingMessage } from "http";
import { NextApiRequest } from "next";
import { join } from "path";
import { getUserToken } from "src/server/auth/cookie";
import { validateUserToken } from "src/server/auth/token";
import { clusters } from "src/server/trpc/route/config";
import { getAdapterClient } from "src/server/utils/clusters";
import { BASE_PATH, USE_MOCK } from "src/utils/processEnv";
import { WebSocket, WebSocketServer } from "ws";

export interface ShellQuery {
  cluster: string;

  cols?: string;
  rows?: string;
};

export type ShellInputData =
  | { $case: "resize", resize: { cols: number; rows: number } }
  | { $case: "data", data: { data: string } }
  | { $case: "disconnect" }
  ;
export type ShellOutputData =
  | { $case: "data", data: { data: number[] | { type: "Buffer"; data: number[] } | string } }
  | { $case: "exit", exit: { code?: number; signal?: string } }
  ;
export const config = {
  api: {
    bodyParser: false,
  },
};


const wss = new WebSocketServer({ noServer: true });

// https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
type AliveCheckedWebSocket = WebSocket & { isAlive: boolean };

function heartbeat(this: AliveCheckedWebSocket) {
  this.isAlive = true;
}

function isAliveCheckedWebSocket(ws: WebSocket): ws is AliveCheckedWebSocket {
  return "isAlive" in ws;
}

// ping every clients every 30s
const pingInterval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (!isAliveCheckedWebSocket(ws)) {
      console.warn("WebSocket has not been extended to AliveCheckedWebSocket.");
      return;
    }

    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", function close() {
  clearInterval(pingInterval);
});

wss.on("connection", async (ws: AliveCheckedWebSocket, req) => {

  const token = getUserToken(req);

  if (!token) {
    console.log("[shell] token is not valid");
    ws.close(0, "token is not valid");
    return;
  }

  const identityId = await validateUserToken(token);

  if (!identityId) {
    console.log("[shell] userInfo is not valid");
    ws.close(0, "userInfo is not valid");
    return;
  }

  const log = (message: string, ...optionalParams: any[]) => console.log(
    `[io] [${identityId}] ${message}`, optionalParams);
  let closed = false;

  log("Connection request received.");

  const fullUrl = "http://example.com" + req.url;
  const query = new URL(fullUrl).searchParams;

  const clusterId = query.get("cluster");
  const jobId = query.get("jobId");
  const namespace = query.get("namespace");
  const podName = query.get("podName");

  if (!jobId) {
    log("[params] param-jobId not passed");
    ws.close(0, "param-jobId not passed");
    return;
  }

  if (!namespace) {
    log("[params] param-namespace not passed");
    ws.close(0, "param-namespace not passed");
    return;
  }

  if (!podName) {
    log("[podName] param-podName not passed");
    ws.close(0, "param-podName not passed");
    return;
  }

  if (!clusterId || !clusters[clusterId]) {
    log("[params] param-clusterId not passed or unknown");
    ws.close(0, "param-clusterId not passed or unknown");
    return;
  }

  // 根据jobId获取该应用运行在集群的节点和对应的containerId
  const client = getAdapterClient(clusterId);

  const { job: jobInfo } = await asyncClientCall(client.job, "getJobById", {
    jobId: Number(jobId),
    fields: ["user", "state", "pods"],
  });

  if (!jobInfo) {
    log(`[shell] Job ${jobId} is not exists`);
    ws.close(0, `Job ${jobId} is not exists`);
    return;
  }

  if (jobInfo.user !== identityId) {
    log("[shell] Job user not match");
    ws.close(0, "Job user not match");
    return;
  }

  if (jobInfo.state != "RUNNING") {
    log(`[shell] Job ${jobId} is not running`);
    ws.close(0, `Job ${jobId} is not running`);
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    // 使用箭头函数确保this上下文为AliveCheckedWebSocket
    heartbeat.call(ws);
  });

  ws.ping();

  const send = (data: ShellOutputData) => {
    ws.send(JSON.stringify(data));
  };

  const isValidPod = jobInfo.pods.some((p) => p.namespace === namespace && p.podName === podName);

  if (!isValidPod) {
    log("[shell] Provided podName/namespace not found in job's pod list");
    ws.close(0, "Invalid podName or namespace for this job");
    return;
  }

  try {
    const connectInfo = {
      jobId,
      namespace,
      podName,
      containerName: "",
    };
    const stream = client.job.streamJobShell();
    let cleanedUp = false;
    let authChecking = false;
    let authCheckInterval: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (cleanedUp) { return; }
      cleanedUp = true;
      if (authCheckInterval) {
        clearInterval(authCheckInterval);
        authCheckInterval = undefined;
      }
      try {
        stream.write({ payload: { $case: "disconnect", disconnect: {} } });
      } catch (e) { void e; }
      try {
        stream.end();
      } catch (e) { void e; }
      try {
        stream.removeAllListeners();
      } catch (e) { void e; }
    };

    stream.write({
      payload: { $case: "connect", connect: connectInfo },
    });

    log("Connected to shell");

    if (process.env.NODE_ENV !== "test" && !USE_MOCK && token) {
      authCheckInterval = setInterval(async () => {
        if (closed || cleanedUp || authChecking) { return; }
        authChecking = true;
        const authIdentity = await validateUserToken(token);
        authChecking = false;

        if (!authIdentity || authIdentity !== identityId) {
          log("token is not valid when connection alive");
          closed = true;
          cleanup();
          try {
            send({ $case: "exit", exit: { code: 401 } });
          } catch (e) {
            log("Error occurred when sending exit message", e);
          }
          ws.close(4001, "token is not valid");
        }
      }, 300000);
    }

    stream.on("data", (chunk) => {
      const payload = chunk.payload;
      if (!payload) {
        return;
      }

      switch (payload.$case) {
        case "data":
          send({ $case: "data", data: { data: Array.from(payload.data.data) } });
          break;
        case "exit":
          send({ $case: "exit", exit: { code: payload.exit.code, signal: payload.exit.signal } });
          break;
        case "error":
          log("[shell] Received error from adapter", payload.error.message);
          send({ $case: "data", data: { data: Array.from(Buffer.from(payload.error.message, "utf8")) } });
          send({ $case: "exit", exit: { code: 1, signal: "ERROR" } });
          break;
      }
    });

    stream.on("error", (err) => {
      log("Error occurred from adapter. Disconnect.", err);
      closed = true;
      try {
        send({ $case: "exit", exit: { code: 1 } });
      } catch (e) {
        void e;
      }
      cleanup();
      ws.close(1011, "server error");
    });

    // 监听来自客户端WebSocket的消息并写入适配器stream
    ws.on("message", (data) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const message = JSON.parse(data.toString()) as ShellInputData;
      switch (message.$case) {
        case "data":
          stream.write({
            payload: { $case: "data", data: { data: message.data.data } },
          });
          break;
        case "resize":
          stream.write({
            payload: {
              $case: "resize",
              resize: { cols: message.resize.cols, rows: message.resize.rows },
            },
          });
          break;
        case "disconnect":
          closed = true;
          cleanup();
          break;
      }
    });

    ws.on("close", () => {
      closed = true;
      cleanup();
    });

    ws.on("error", (err) => {
      closed = true;
      log("Error occurred from client. Disconnect.", err);
      cleanup();
    });
  } catch (error) {
    console.error("Error executing command via adapter", error);
    ws.close();
  }
});

export const setupJobShellServer = (req: NextApiRequest) => {

  (req.socket as any).server.on("upgrade", async (req: IncomingMessage,
    socket: any, head: any) => {
    const url = normalizePathnameWithQuery(req.url!);
    if (!url.startsWith(join(BASE_PATH, "/api/jobShell"))) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      // 动态地为 WebSocket 实例添加 isAlive 属性
      const extendedWs = ws as AliveCheckedWebSocket;
      extendedWs.isAlive = true;

      wss.emit("connection", extendedWs, req);
    });

  });
};
