import { asyncDuplexStreamCall } from "@ddadaal/tsgrpc-client";
import { getLoginNode } from "@scow/config/build/cluster";
import { validateToken as authValidateToken } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { libQueryIsUserEnabledRootShell } from "@scow/lib-web/build/server/user";
import { queryToIntOrDefault } from "@scow/lib-web/build/utils/querystring";
import { ShellResponse, ShellServiceClient } from "@scow/protos/build/portal/shell";
import { normalizePathnameWithQuery } from "@scow/utils";
import { NextApiRequest } from "next";
import { join } from "path";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { checkCookie } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { runtimeConfig } from "src/utils/config";
import { parseIp } from "src/utils/server";
import { parse } from "url";
import { RawData, WebSocket, WebSocketServer } from "ws";

import { getClusterConfigFiles } from "../clusterConfig";

export interface ShellQuery {
  cluster: string;
  loginNode: string;
  path?: string;

  cols?: string;
  rows?: string;
}

export type ShellInputData =
  | { $case: "resize"; resize: { cols: number; rows: number } }
  | { $case: "data"; data: { data: string } }
  | { $case: "disconnect" };
export type ShellOutputData =
  | { $case: "data"; data: { data: string } }
  | { $case: "exit"; exit: { code?: number; signal?: string } };
export const config = {
  api: {
    bodyParser: false,
  },
};

const wss = new WebSocketServer({ noServer: true });

type AliveCheckedWebSocket = WebSocket & { isAlive: boolean };

function heartbeat(this: AliveCheckedWebSocket) {
  this.isAlive = true;
}

// ping every clients every 30s
const pingInterval = setInterval(function ping() {
  wss.clients.forEach(function each(ws: AliveCheckedWebSocket) {
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
  const user = await checkCookie(() => true, req);

  if (typeof user === "number") {
    // console.log("[shell] token is not valid");
    ws.close(0, "token is not valid");
    return;
  }

  const log = (message: string, ...optionalParams: any[]) => {
    console.log(`[${new Date().toISOString()}] [io] [${user.identityId}] ${message}`, optionalParams);
  };

  const token = getTokenFromCookie({ req });
  let closed = false;

  log("Connection request received.");

  const query = new URLSearchParams(parse(req.url!).query!);

  const cluster = query.get("cluster");
  const loginNodeAddress = query.get("loginNode");
  const useRoot = query.get("useRoot");
  let isUserUseRoot = false;

  if (useRoot === "true") {
    const { result: isUserEnabledRoot } = await libQueryIsUserEnabledRootShell(
      user.identityId,
      publicConfig.MIS_SERVER_URL,
      runtimeConfig.SCOW_API_AUTH_TOKEN,
    );

    isUserUseRoot = isUserEnabledRoot;
  }

  const clusterConfigs = await getClusterConfigFiles();

  if (!cluster || !clusterConfigs[cluster]) {
    throw new Error(`Unknown cluster ${cluster}`);
  }

  const loginNode = clusterConfigs[cluster].loginNodes.map(getLoginNode).find((x) => x.address === loginNodeAddress);

  // unknown login node
  if (!loginNode) {
    throw new Error(`Unknown login node ${loginNodeAddress}`);
  }

  ws.isAlive = true;
  ws.on("pong", heartbeat);

  ws.ping();

  const path = query.get("path") ?? undefined;
  const cols = query.get("cols");
  const rows = query.get("rows");

  const client = getClient(ShellServiceClient);

  const stream = asyncDuplexStreamCall(client, "shell");

  await stream.writeAsync({
    message: {
      $case: "connect",
      connect: {
        cluster,
        loginNode: loginNode.address,
        userId: isUserUseRoot ? "root" : user.identityId,
        cols: queryToIntOrDefault(cols, 80),
        rows: queryToIntOrDefault(rows, 30),
        path,
      },
    },
  });

  log("Connected to shell");

  await callLog(
    {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shellLogin,
      operationTypePayload: {
        clusterId: cluster,
        loginNode: loginNode.address,
      },
    },
    OperationResult.SUCCESS,
  );

  const send = (data: ShellOutputData) => {
    ws.send(JSON.stringify(data));
  };

  let cleanedUp = false;
  let authChecking = false;
  let authCheckInterval: NodeJS.Timeout | undefined;
  let isStreamWritable = true;
  let pendingMessages: Buffer[] = [];

  /* eslint-disable prefer-const */
  // 保存事件处理器引用以便正确清理
  let handleMessage: ((data: RawData) => void) | undefined;
  let handleClose: ((...args: any[]) => void) | undefined;
  let handleError: ((err: Error) => void) | undefined;
  let handleStreamDrain: (() => void) | undefined;
  let handleStreamError: ((err: Error) => void) | undefined;
  let handleStreamData: ((chunk: ShellResponse) => void) | undefined;
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
            message: { $case: "data", data: { data: Uint8Array.from(Buffer.from(message.data.data)) } },
          });
          break;
        case "resize":
          writeSuccess = stream.write({
            message: {
              $case: "resize",
              resize: {
                cols: message.resize.cols,
                rows: message.resize.rows,
              },
            },
          });
          break;
        case "disconnect":
          writeSuccess = stream.write({ message: { $case: "disconnect", disconnect: {} } });
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
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;

    log("Cleaning up resources.");

    // 1. 清理认证检查定时器
    if (authCheckInterval) {
      clearInterval(authCheckInterval);
      authCheckInterval = undefined;
    }

    // 2. 清理WebSocket事件监听器
    safeExecute(() => {
      ws.removeListener("pong", heartbeat);
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
      stream.write({ message: { $case: "disconnect", disconnect: {} } });
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

  if (process.env.NODE_ENV !== "test" && !USE_MOCK && token) {
    authCheckInterval = setInterval(async () => {
      if (closed || cleanedUp || authChecking) {
        return;
      }
      authChecking = true;
      const authResult = await authValidateToken(runtimeConfig.AUTH_INTERNAL_URL, token).catch(() => undefined);
      authChecking = false;

      if (!authResult || authResult.identityId !== user.identityId) {
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

  handleStreamError = (err) => {
    log("Error occurred from server. Disconnect.", err);
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

  handleStreamData = (chunk: ShellResponse) => {
    switch (chunk.message?.$case) {
      case "data":
        send({ $case: "data", data: { data: chunk.message.data.data.toString() } });
        break;
      case "exit":
        send({ $case: "exit", exit: { code: chunk.message.exit.code, signal: chunk.message.exit.signal } });
        break;
    }
  };
  stream.on("data", handleStreamData);

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
    // 不等待异步操作完成，避免阻塞清理流程
    callLog(
      {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.shellLogin,
        operationTypePayload: {
          clusterId: cluster,
          loginNode: loginNode.address,
        },
      },
      OperationResult.FAIL,
    ).catch((e) => log("Failed to log shell error:", e));
    cleanup();
  };

  // 注册事件监听器
  ws.on("message", handleMessage);
  ws.on("close", handleClose);
  ws.on("error", handleError);
});

export const setupShellServer = (req: NextApiRequest) => {
  (req.socket as any).server.on("upgrade", (request, socket, head) => {
    const url = normalizePathnameWithQuery(request.url);
    if (!url.startsWith(join(publicConfig.BASE_PATH, "/api/shell"))) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
};
