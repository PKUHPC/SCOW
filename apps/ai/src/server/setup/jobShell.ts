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
import { RawData, WebSocket, WebSocketServer } from "ws";

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
      console.log("WebSocket has not been extended to AliveCheckedWebSocket.");
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
    `[${new Date().toISOString()}] [io] [${identityId}] ${message}`, optionalParams);
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
    let isStreamWritable = true;
    let pendingMessages: Buffer[] = [];

    /* eslint-disable prefer-const */
    // 保存事件处理器引用以便正确清理
    let handleMessage: ((data: RawData) => void) | undefined;
    let handleClose: (() => void) | undefined;
    let handleError: ((err: Error) => void) | undefined;
    let handleStreamDrain: (() => void) | undefined;
    let handleStreamError: ((err: Error) => void) | undefined;
    let handleStreamData: ((chunk: any) => void) | undefined;
    /* eslint-enable prefer-const */

    // 公共函数：进行错误处理的包装
    const safeExecute = (operation: () => void, description: string) => {
      try {
        operation();
      } catch (e) {
        log(`Failed to ${description}:`, e);
      }
    };

    // 公共函数：向流中写入消息
    const writeToStream = (data: Buffer): boolean => {
      try {
        const message = JSON.parse(data.toString()) as ShellInputData;
        let writeSuccess = false;

        switch (message.$case) {
          case "data":
            writeSuccess = stream.write({
              payload: { $case: "data", data: { data: message.data.data } },
            });
            break;
          case "resize":
            writeSuccess = stream.write({
              payload: {
                $case: "resize",
                resize: { cols: message.resize.cols, rows: message.resize.rows },
              },
            });
            break;
          case "disconnect":
            writeSuccess = stream.write({ payload: { $case: "disconnect", disconnect: {} } });
            closed = true;
            cleanup();
            return writeSuccess;
        }

        return writeSuccess;
      } catch (e) {
        log("Failed to write message to stream:", e);
        return false;
      }
    };

    const cleanup = () => {
      if (cleanedUp) { return; }
      cleanedUp = true;

      log("Cleaning up resources.");

      // 1. 清理认证检查定时器
      if (authCheckInterval) {
        clearInterval(authCheckInterval);
        authCheckInterval = undefined;
      }

      // 2. 清理WebSocket事件监听器
      safeExecute(() => {
        if (handleMessage) ws.removeListener("message", handleMessage);
        if (handleClose) ws.removeListener("close", handleClose);
        if (handleError) ws.removeListener("error", handleError);
      }, "cleanup WebSocket listeners");

      // 3. 清理Stream事件监听器（必须在end之前）
      safeExecute(() => {
        if (handleStreamDrain) stream.removeListener("drain", handleStreamDrain);
        if (handleStreamError) stream.removeListener("error", handleStreamError);
        if (handleStreamData) stream.removeListener("data", handleStreamData);
      }, "cleanup Stream listeners");

      // 4. 清空待发送消息队列
      pendingMessages = [];

      // 5. 断开gRPC Stream连接
      safeExecute(() => {
        stream.write({ payload: { $case: "disconnect", disconnect: {} } });
      }, "write disconnect to stream");

      safeExecute(() => {
        stream.end();
      }, "end stream");
    };

    // 处理服务器端drain事件
    handleStreamDrain = () => {
      log("Stream buffer drained, resuming writes.");
      isStreamWritable = true;

      // 发送待处理的消息
      while (pendingMessages.length > 0 && isStreamWritable) {
        const messageBuffer = pendingMessages.shift();
        if (!messageBuffer) break;

        if (!writeToStream(messageBuffer)) {
          isStreamWritable = false;
          // 消息重新加入队列首部
          pendingMessages.unshift(messageBuffer);
          break;
        }
      }
    };
    stream.on("drain", handleStreamDrain);

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
          safeExecute(() => {
            send({ $case: "exit", exit: { code: 401 } });
          }, "send exit message");
          ws.close(4001, "token is not valid");
        }
      }, 300000);
    }

    handleStreamData = (chunk) => {
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
    };
    stream.on("data", handleStreamData);

    handleStreamError = (err) => {
      log("Error occurred from adapter. Disconnect.", err);
      closed = true;
      cleanup();
      safeExecute(() => {
        send({ $case: "exit", exit: { code: 1 } });
      }, "send exit message");
      safeExecute(() => {
        ws.close(1011, "server error");
      }, "close websocket");
    };
    stream.on("error", handleStreamError);

    // 保存事件处理器以便后续清理
    handleMessage = (data: RawData) => {

      // 如果流不可写，将消息加入待处理队列
      if (!isStreamWritable) {
        log("Stream not writable, queuing message.");
        pendingMessages.push(data as Buffer);
        return;
      }

      // 使用公共函数写入到流
      const writeSuccess = writeToStream(data as Buffer);

      // 如果写入失败，设置流状态并重排队消息
      if (!writeSuccess) {
        log("Stream write failed, buffering data.");
        isStreamWritable = false;
        // 重排队当前消息
        pendingMessages.push(data as Buffer);
      }
    };

    handleClose = () => {
      closed = true;
      log("WebSocket closed.");
      cleanup();
    };

    handleError = (err: Error) => {
      closed = true;
      log("Error occurred from client. Disconnect.", err);
      cleanup();
    };

    // 监听来自客户端WebSocket的消息并写入适配器stream
    ws.on("message", handleMessage);
    ws.on("close", handleClose);
    ws.on("error", handleError);
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
