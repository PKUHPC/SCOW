
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
import { WebSocket, WebSocketServer } from "ws";

import { getClusterConfigFiles } from "../clusterConfig";

export interface ShellQuery {
  cluster: string;
  loginNode: string;
  path?: string;

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
    console.log("[shell] token is not valid");
    ws.close(0, "token is not valid");
    return;
  }

  const log = (message: string, ...optionalParams: any[]) => console.log(
    `[io] [${user.identityId}] ${message}`, optionalParams);

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
      user.identityId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);

    isUserUseRoot = isUserEnabledRoot;
  }

  const clusterConfigs = await getClusterConfigFiles();

  if (!cluster || !clusterConfigs[cluster]) {
    throw new Error(`Unknown cluster ${cluster}`);
  }

  const loginNode = clusterConfigs[cluster].loginNodes.map(getLoginNode).find(
    (x) => x.address === loginNodeAddress,
  );

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
      $case: "connect", connect: {
        cluster, loginNode: loginNode.address, userId: isUserUseRoot ? "root" : user.identityId,
        cols: queryToIntOrDefault(cols, 80),
        rows: queryToIntOrDefault(rows, 30),
        path,
      },
    },
  });

  log("Connected to shell");

  await callLog({
    operatorUserId: user.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.shellLogin,
    operationTypePayload: {
      clusterId: cluster, loginNode: loginNode.address,
    },
  }, OperationResult.SUCCESS);

  const send = (data: ShellOutputData) => {
    ws.send(JSON.stringify(data));
  };

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
      stream.write({ message: { $case: "disconnect", disconnect: {} } });
    } catch (e) { void e; }
    try {
      stream.end();
    } catch (e) { void e; }
    try {
      stream.removeAllListeners();
    } catch (e) { void e; }
  };

  if (process.env.NODE_ENV !== "test" && !USE_MOCK && token) {
    authCheckInterval = setInterval(async () => {
      if (closed || cleanedUp || authChecking) { return; }
      authChecking = true;
      const authResult = await authValidateToken(runtimeConfig.AUTH_INTERNAL_URL, token).catch(() => undefined);
      authChecking = false;

      if (!authResult || authResult.identityId !== user.identityId) {
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

  stream.on("error", (err) => {
    log("Error occurred from server. Disconnect.", err);
    closed = true;
    try {
      send({ $case: "exit", exit: { code: 1 } });
    } catch (e) {
      void e;
    }
    cleanup();
    try {
      ws.close(1011, "server error");
    } catch (e) {
      void e;
    }
  });


  stream.on("data", (chunk: ShellResponse) => {
    switch (chunk.message?.$case) {
      case "data":
        send({ $case: "data", data: { data: chunk.message.data.data.toString() } });
        break;
      case "exit":
        send({ $case: "exit", exit: { code: chunk.message.exit.code, signal: chunk.message.exit.signal } });
        break;
    }
  });

  ws.on("message", (data) => {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const message = JSON.parse(data.toString()) as ShellInputData;

    switch (message.$case) {
      case "data":
        stream.write({ message: { $case: "data", data: { data: Uint8Array.from(Buffer.from(message.data.data)) } } });
        break;
      case "resize":
        stream.write({
          message: {
            $case: "resize", resize: {
              cols: message.resize.cols, rows: message.resize.rows,
            },
          },
        });
        break;
      case "disconnect":
        closed = true;
        cleanup();
        break;
    }

  });

  ws.on("close", async () => {
    closed = true;
    cleanup();
  });

  ws.on("error", async (err) => {
    closed = true;
    log("Error occurred from client. Disconnect.", err);
    await callLog({
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shellLogin,
      operationTypePayload: {
        clusterId: cluster, loginNode: loginNode.address,
      },
    }, OperationResult.FAIL);
    cleanup();
  });
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
