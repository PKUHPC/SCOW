import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import * as k8sClient from "@kubernetes/client-node";
import { normalizePathnameWithQuery } from "@scow/utils";
import { IncomingMessage } from "http";
import { NextApiRequest } from "next";
import { join } from "path";
import { getUserToken } from "src/server/auth/cookie";
import { validateUserToken } from "src/server/auth/token";
import { clusters } from "src/server/trpc/route/config";
import { getAdapterClient } from "src/server/utils/clusters";
import { BASE_PATH } from "src/utils/processEnv";
import { PassThrough } from "stream";
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
  | { $case: "data", data: { data: string } }
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

  if (!clusters[clusterId].k8s?.kubeconfig.path) {
    log("[config] The current cluster does not have kubeconfig configured.");
    ws.close(0, "The current cluster does not have kubeconfig configured.");
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

  // 创建PassThrough流作为stdin, stdout, stderr
  const stdinStream = new PassThrough();
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();

  // 将Kubernetes stdout和stderr的输出发送回WebSocket客户端
  stdoutStream.on("data", (data) => {
    send({ $case: "data", data: { data: data.toString() } });
  });

  stderrStream.on("data", (data) => {
    send({ $case: "data", data: { data: data.toString() } });
  });

  ws.on("error", async (err) => {
    log("Error occurred from client. Disconnect.", err);
    stdinStream.end(); // 结束stdin流输入
  });

  const isValidPod = jobInfo.pods.some((p) => p.namespace === namespace && p.podName === podName);

  if (!isValidPod) {
    log("[shell] Provided podName/namespace not found in job's pod list");
    ws.close(0, "Invalid podName or namespace for this job");
    return;
  }

  try {
    const kc = new k8sClient.KubeConfig();
    kc.loadFromFile(join("/etc/scow", clusters[clusterId].k8s?.kubeconfig.path || "/kube/config"));
    const k8sWs = await new k8sClient.Exec(kc)
      .exec(namespace, podName, "", ["/bin/sh"], stdoutStream, stderrStream, stdinStream, true);

    log("Connected to shell");

    // 监听来自客户端WebSocket的消息并写入stdinStream
    ws.on("message", (data) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const message = JSON.parse(data.toString());

      switch (message.$case) {
        case "data":
          stdinStream.write(message.data.data);
          break;
        case "resize":
          stdinStream.write(
            `stty cols ${message.resize.cols} rows ${message.resize.rows}\n`);
          break;
        case "disconnect":
          stdinStream.end();
          break;
      }
    });

    ws.on("close", () => {
      // 关闭相关流，以确保Kubernetes端的命令执行可以正确结束
      stdinStream.end();
      stdoutStream.end();
      stderrStream.end();
      k8sWs.close();
    });
  } catch (error) {
    console.error("Error executing command in Kubernetes", error);
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

