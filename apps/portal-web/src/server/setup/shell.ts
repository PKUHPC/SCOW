/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncDuplexStreamCall } from "@ddadaal/tsgrpc-client";
import { getLoginNode } from "@scow/config/build/cluster";
import { OperationType } from "@scow/lib-operation-log";
import { queryToIntOrDefault } from "@scow/lib-web/build/utils/querystring";
import { ShellResponse, ShellServiceClient } from "@scow/protos/build/portal/shell";
import { normalizePathnameWithQuery } from "@scow/utils";
import { NextApiRequest } from "next";
import { join } from "path";
import { checkCookie } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { parseIp } from "src/utils/server";
import { parse } from "url";
import { WebSocket, WebSocketServer } from "ws";

import { getClusterConfigFiles } from "../clusterConfig";

export type ShellQuery = {
  cluster: string;
  loginNode: string;
  path?: string;

  cols?: string;
  rows?: string;
}

export type ShellInputData =
  | { $case: "resize", resize: { cols: number; rows: number } }
  | { $case: "data", data: { data: string }}
  | { $case: "disconnect" }
;
export type ShellOutputData =
  | { $case: "data", data: { data: string } }
  | { $case: "exit", exit: { code?: number; signal?: string }}
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

  log("Connection request received.");

  const query = new URLSearchParams(parse(req.url!).query!);

  const cluster = query.get("cluster");
  const loginNodeAddress = query.get("loginNode");

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

  await stream.writeAsync({ message: { $case: "connect", connect: {
    cluster, loginNode: loginNode.address, userId: user.identityId,
    cols: queryToIntOrDefault(cols, 80),
    rows: queryToIntOrDefault(rows, 30),
    path,
  } } });

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

  stream.on("error", (err) => {
    log("Error occurred from server. Disconnect.", err);
    send({ $case: "exit", exit: { code: 1 } });
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
    const message = JSON.parse(data.toString()) as ShellInputData;

    switch (message.$case) {
    case "data":
      stream.write({ message:  { $case :"data", data: { data: Buffer.from(message.data.data) } } });
      break;
    case "resize":
      stream.write({ message: { $case: "resize", resize: { cols: message.resize.cols, rows: message.resize.rows } } });
      break;
    case "disconnect":
      stream.write({ message: { $case: "disconnect", disconnect: {} } });
      stream.end();
      break;
    }

  });

  ws.on("error", async (err) => {
    log("Error occurred from client. Disconnect.", err);
    await callLog({
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.shellLogin,
      operationTypePayload: {
        clusterId: cluster, loginNode: loginNode.address,
      },
    }, OperationResult.FAIL);
    stream.write({ message: { $case: "disconnect", disconnect: {} } });
    stream.end();
  });
});

export const setupShellServer = (req: NextApiRequest) => {

  (req.socket as any).server.on("upgrade", (request, socket, head) => {
    const url = normalizePathnameWithQuery(request.url!);
    if (!url.startsWith(join(publicConfig.BASE_PATH, "/api/shell"))) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });

  });
};

