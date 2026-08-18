import { Code, ConnectError } from "@connectrpc/connect";
import { getLoginNode } from "@scow/config/build/cluster";
import { getScowdClient as getScowdClientByUrl } from "@scow/lib-scowd/build/client";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { libQueryIsUserEnabledRootShell } from "@scow/lib-web/build/server/user";
import { queryToIntOrDefault } from "@scow/lib-web/build/utils/querystring";
import { normalizePathnameWithQuery } from "@scow/utils";
import { IncomingMessage } from "http";
import { NextApiRequest } from "next";
import { join } from "path";
import { getUserToken } from "src/server/auth/cookie";
import { validateUserToken } from "src/server/auth/token";
import { clusters } from "src/server/config/clusters";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { callLog } from "src/server/setup/operationLog";
import { certificates, getLoginNodeScowdUrl } from "src/server/trpc/scowd/scowd";
import { BASE_PATH, USE_MOCK } from "src/utils/processEnv";
import { RawData, WebSocket, WebSocketServer } from "ws";

export type ShellInputData =
  | { $case: "resize"; resize: { cols: number; rows: number } }
  | { $case: "data"; data: { data: string } }
  | { $case: "disconnect" };

export type ShellOutputData =
  | { $case: "data"; data: { data: number[] | { type: "Buffer"; data: number[] } | string } }
  | { $case: "exit"; exit: { code?: number; signal?: string } };

const wss = new WebSocketServer({ noServer: true });

type AliveCheckedWebSocket = WebSocket & { isAlive: boolean };

const NORMAL_CLOSE_CODE = 1000;
const POLICY_VIOLATION_CLOSE_CODE = 1008;

const parseIncomingMessageIp = (req: IncomingMessage): string | undefined => {
  let forwardedFor = req.headers["x-forwarded-for"];

  if (Array.isArray(forwardedFor)) {
    forwardedFor = forwardedFor.shift();
  }

  if (typeof forwardedFor === "string") {
    forwardedFor = forwardedFor.split(",").shift();
  }

  return forwardedFor || req.socket.remoteAddress;
};

function heartbeat(this: AliveCheckedWebSocket) {
  this.isAlive = true;
}

function isAliveCheckedWebSocket(ws: WebSocket): ws is AliveCheckedWebSocket {
  return "isAlive" in ws;
}

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
    ws.close(POLICY_VIOLATION_CLOSE_CODE, "token is not valid");
    return;
  }

  const identityId = await validateUserToken(token);

  if (!identityId) {
    console.log("[shell] userInfo is not valid");
    ws.close(POLICY_VIOLATION_CLOSE_CODE, "userInfo is not valid");
    return;
  }

  const log = (message: string, ...optionalParams: any[]) =>
    console.log(`[${new Date().toISOString()}] [shell] [${identityId}] ${message}`, optionalParams);

  let closed = false;
  log("Connection request received.");

  const fullUrl = "http://example.com" + req.url;
  const query = new URL(fullUrl).searchParams;

  const cluster = query.get("cluster");
  const loginNodeAddress = query.get("loginNode");
  const path = query.get("path") ?? undefined;
  const cols = query.get("cols");
  const rows = query.get("rows");

  const send = (data: ShellOutputData) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  const closeWithData = (message: string, code = POLICY_VIOLATION_CLOSE_CODE) => {
    log(message);
    send({ $case: "data", data: { data: Array.from(Buffer.from(message + "\r\n", "utf8")) } });
    send({ $case: "exit", exit: { code } });
    ws.close(code, message);
  };

  if (!cluster || !clusters[cluster]) {
    closeWithData("[params] param-cluster not passed or unknown");
    return;
  }

  if (!loginNodeAddress) {
    closeWithData("[params] param-loginNode not passed");
    return;
  }

  const loginNode = clusters[cluster].loginNodes.map(getLoginNode).find((x) => x.address === loginNodeAddress);
  if (!loginNode) {
    closeWithData(`login node ${loginNodeAddress} is not found in cluster ${cluster}`);
    return;
  }

  const scowdUrl = getLoginNodeScowdUrl(cluster, loginNode.address);
  if (!scowdUrl) {
    closeWithData(`scowd is not available on login node ${loginNode.address}`);
    return;
  }

  const { result: isRootShellEnabled } = await libQueryIsUserEnabledRootShell(
    identityId,
    config.MIS_SERVER_URL,
    commonConfig.scowApi.auth.token,
  );

  if (!isRootShellEnabled) {
    closeWithData("root shell is not enabled for current user");
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    heartbeat.call(ws);
  });
  ws.ping();

  const abortController = new AbortController();
  const messages: ShellInputData[] = [
    {
      $case: "data",
      data: { data: "" },
    },
  ];
  let notifyMessage: (() => void) | undefined;
  let cleanedUp = false;
  let authChecking = false;
  let authCheckInterval: NodeJS.Timeout | undefined;
  let streamEnded = false;
  let exitSent = false;

  const safeExecute = (operation: () => void, description: string) => {
    try {
      operation();
    } catch (e) {
      log(`Failed to ${description}:`, e);
    }
  };

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;

    log("Cleaning up resources.");

    if (authCheckInterval) {
      clearInterval(authCheckInterval);
      authCheckInterval = undefined;
    }

    safeExecute(() => {
      ws.removeListener("message", handleMessage);
      ws.removeListener("close", handleClose);
      ws.removeListener("error", handleError);
    }, "cleanup WebSocket listeners");

    messages.length = 0;
    notifyMessage?.();

    safeExecute(() => {
      abortController.abort();
    }, "abort scowd stream");
  };

  async function* requestGenerator() {
    const connectRequest = {
      message: {
        case: "connect" as const,
        value: {
          userId: "root",
          path,
          cols: queryToIntOrDefault(cols, 80),
          rows: queryToIntOrDefault(rows, 30),
        },
      },
    };
    yield connectRequest;

    while (!cleanedUp) {
      const message = messages.shift();
      if (!message) {
        await new Promise<void>((resolve) => {
          notifyMessage = resolve;
        });
        notifyMessage = undefined;
        continue;
      }

      switch (message.$case) {
        case "data": {
          if (!message.data.data) {
            continue;
          }
          const dataRequest = {
            message: {
              case: "data" as const,
              value: { data: new TextEncoder().encode(message.data.data) },
            },
          };
          yield dataRequest;
          break;
        }
        case "resize": {
          const resizeRequest = {
            message: {
              case: "resize" as const,
              value: { cols: message.resize.cols, rows: message.resize.rows },
            },
          };
          yield resizeRequest;
          break;
        }
        case "disconnect": {
          const disconnectRequest = {
            message: {
              case: "disconnect" as const,
              value: {},
            },
          };
          yield disconnectRequest;
          return;
        }
      }
    }
  }

  const enqueue = (message: ShellInputData) => {
    messages.push(message);
    notifyMessage?.();
  };

  const writeToStream = (data: Buffer): boolean => {
    try {
      const message = JSON.parse(data.toString()) as ShellInputData;
      enqueue(message);

      if (message.$case === "disconnect") {
        closed = true;
      }
      return true;
    } catch (e) {
      log("Failed to queue message to stream:", e);
      return false;
    }
  };

  if (process.env.NODE_ENV !== "test" && !USE_MOCK && token) {
    authCheckInterval = setInterval(async () => {
      if (closed || cleanedUp || authChecking) {
        return;
      }
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

  const handleMessage = (data: RawData) => {
    writeToStream(data as Buffer);
  };

  const handleClose = () => {
    closed = true;
    log("WebSocket closed.");
    cleanup();
  };

  const handleError = (err: Error) => {
    closed = true;
    log("Error occurred from client. Disconnect.", err);
    callLog(
      {
        operatorUserId: identityId,
        operatorIp: parseIncomingMessageIp(req) ?? "",
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

  ws.on("message", handleMessage);
  ws.on("close", handleClose);
  ws.on("error", handleError);

  const handleStreamEnd = () => {
    if (streamEnded || cleanedUp) {
      return;
    }
    streamEnded = true;
    log("scowd stream ended.");
    closed = true;

    if (!exitSent) {
      safeExecute(() => {
        send({ $case: "exit", exit: {} });
      }, "send exit message");
    }

    safeExecute(() => {
      ws.close(NORMAL_CLOSE_CODE, "shell session ended");
    }, "close websocket");
    cleanup();
  };

  try {
    const client = getScowdClientByUrl(scowdUrl, certificates);
    const scowdStream = client.shell.shell(requestGenerator(), { signal: abortController.signal });

    log("Connected to shell");

    await callLog(
      {
        operatorUserId: identityId,
        operatorIp: parseIncomingMessageIp(req) ?? "",
        operationTypeName: OperationType.shellLogin,
        operationTypePayload: {
          clusterId: cluster,
          loginNode: loginNode.address,
        },
      },
      OperationResult.SUCCESS,
    );

    for await (const data of scowdStream) {
      if (!data.message.case) {
        continue;
      }

      if (data.message.case === "data") {
        send({ $case: "data", data: { data: Array.from(data.message.value.data) } });
      }

      if (data.message.case === "exit") {
        exitSent = true;
        send({ $case: "exit", exit: { code: data.message.value.code, signal: data.message.value.signal } });
        break;
      }
    }

    handleStreamEnd();
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.Canceled && cleanedUp) {
      return;
    }
    log("Error occurred from scowd. Disconnect.", err);
    safeExecute(() => {
      send({ $case: "exit", exit: { code: 1 } });
    }, "send exit message");
    safeExecute(() => {
      ws.close(1011, "server error");
    }, "close websocket");
  } finally {
    cleanup();
  }
});

export const setupShellServer = (req: NextApiRequest) => {
  (req.socket as any).server.on("upgrade", async (req: IncomingMessage, socket: any, head: any) => {
    const url = normalizePathnameWithQuery(req.url!);
    if (!url.startsWith(join(BASE_PATH, "/api/shell"))) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const extendedWs = ws as AliveCheckedWebSocket;
      extendedWs.isAlive = true;

      wss.emit("connection", extendedWs, req);
    });
  });
};
