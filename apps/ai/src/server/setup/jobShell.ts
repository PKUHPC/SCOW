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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import * as k8sClient from "@kubernetes/client-node";
import { queryToIntOrDefault } from "@scow/lib-web/build/utils/querystring";
import { normalizePathnameWithQuery } from "@scow/utils";
import { IncomingMessage } from "http";
import { NextApiRequest } from "next";
import { join } from "path";
import { getUserToken } from "src/server/auth/cookie";
import { validateToken } from "src/server/auth/token";
import { clusters } from "src/server/trpc/route/config";
import { getAdapterClient } from "src/server/utils/clusters";
import { BASE_PATH } from "src/utils/processEnv";
import { WebSocket, WebSocketServer } from "ws";

export type ShellQuery = {
  cluster: string;

  cols?: string;
  rows?: string;
}

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

  const userInfo = await validateToken(token);

  if (!userInfo) {
    console.log("[shell] userInfo is not valid");
    ws.close(0, "userInfo is not valid");
    return;
  }

  const log = (message: string, ...optionalParams: any[]) => console.log(
    `[io] [${userInfo.identityId}] ${message}`, optionalParams);

  log("Connection request received.");

  const fullUrl = "http://example.com" + req.url;
  const query = new URL(fullUrl).searchParams;

  const clusterId = query.get("cluster");
  const jobId = query.get("jobId");

  if (!jobId) {
    console.log("[shell] param-jobId not passed");
    ws.close(0, "param-jobId not passed");
    return;
  }

  if (!clusterId || !clusters[clusterId]) {
    console.log("[shell] param-clusterId not passed or unknown");
    ws.close(0, "param-clusterId not passed or unknown");
    return;
  }

  // 根据jobId获取该应用运行在集群的节点和对应的containerId
  const client = getAdapterClient(clusterId);

  const runningJobsInfo = await asyncClientCall(client.job, "getJobs", {
    fields: ["job_id"],
    filter: {
      users: [userInfo.identityId], accounts: [],
      states: ["RUNNING"],
    },
  }).then((resp) => resp.jobs);

  const currentJobInfo = runningJobsInfo.find((jobInfo) => String(jobInfo.jobId) === jobId);

  if (!currentJobInfo) {
    console.log("[shell] Get running job node info failed, can't find job ${jobId}");
    ws.close(0, "Get running job node info failed, can't find job ${jobId}");
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    // 使用箭头函数确保this上下文为AliveCheckedWebSocket
    heartbeat.call(ws as AliveCheckedWebSocket);
  });

  ws.ping();

  const kc = new k8sClient.KubeConfig();
  kc.loadFromFile("/etc/scow/ai/kube/config");

  const { namespace, pod, containerId } = await asyncClientCall(client.app, "getRunningJobNodeInfo", {
    jobId: Number(jobId),
  });

  const exec = new k8sClient.Exec(kc);
  const k8sWs = await exec.exec(
    namespace, pod, containerId, ["/bin/sh"], null, null, null, true);

  log("Connected to shell");

  const send = (data: ShellOutputData) => {
    ws.send(JSON.stringify(data));
  };

  // 调整窗口
  const cols = query.get("cols");
  const rows = query.get("rows");

  if (cols && rows) {
    k8sWs.send("4" + Buffer.from(
      "{\"Width\":" + queryToIntOrDefault(cols, 80) + ",\"Height\":" 
      + queryToIntOrDefault(rows, 30) + "}").toString("base64"));
  }

  k8sWs.on("error", (err) => {
    log("Error occurred from k8s api server. Disconnect.", err);
    send({ $case: "exit", exit: { code: 1 } });
  });

  k8sWs.on("close", function close() {
    console.log("Disconnected from the k8s WebSocket server");
  });

  k8sWs.on("message", (data) => {
    const newData = data.toString();
    const message = newData.slice(1);
    switch (newData[0]) {
    case "1":
    case "2":
    case "3":
      const pureMessage = Buffer.from(message, "base64").toString("utf-8");
      console.log("Received message from the server:", pureMessage);
      send({ $case: "data", data: { data: pureMessage } });
      break;
    }
  });


  ws.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ShellInputData;

    switch (message.$case) {
    case "data":
      k8sWs.send("0" + Buffer.from(message.data.data).toString("base64"));
      break;
    case "resize": k8sWs.send("4" + 
    Buffer.from("{\"Width\":" + message.resize.cols + ",\"Height\":" + message.resize.rows + "}").toString("base64"));
      break;
    case "disconnect":
      k8sWs.close();
      break;
    }

  });

  ws.on("error", async (err) => {
    log("Error occurred from client. Disconnect.", err);
    k8sWs.close();
  });
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

