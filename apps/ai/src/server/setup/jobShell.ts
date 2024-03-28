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
import { PassThrough } from "stream";
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
    log("[shell] param-jobId not passed");
    ws.close(0, "param-jobId not passed");
    return;
  }

  if (!clusterId || !clusters[clusterId]) {
    log("[shell] param-clusterId not passed or unknown");
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
    log(`[shell] Get running job node info failed, can't find job ${jobId}`);
    ws.close(0, `Get running job node info failed, can't find job ${jobId}`);
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    // 使用箭头函数确保this上下文为AliveCheckedWebSocket
    heartbeat.call(ws as AliveCheckedWebSocket);
  });

  ws.ping();

  const send = (data: ShellOutputData) => {
    ws.send(JSON.stringify(data));
  };

  // 创建PassThrough流作为stdin, stdout, stderr
  const stdinStream = new PassThrough();
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();

  // 监听来自客户端WebSocket的消息并写入stdinStream
  ws.on("message", (data) => {
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
      stdinStream.end(); // 结束stdin流输入
      break;
    }
  });

  // 将Kubernetes stdout和stderr的输出发送回WebSocket客户端
  let setWindow = false;
  stdoutStream.on("data", (data) => {
    if (data.toString().startsWith("stty")) {
      setWindow = true;
      return;
    };
    if (setWindow === true) {
      setWindow = false;
      return;
    }
    send({ $case: "data", data: { data: data.toString() } });
  });

  stderrStream.on("data", (data) => {
    send({ $case: "data", data: { data: data.toString() } });
  });

  ws.on("error", async (err) => {
    log("Error occurred from client. Disconnect.", err);
    stdinStream.end(); // 结束stdin流输入
  });

  const { namespace, pod } = await asyncClientCall(client.app, "getRunningJobNodeInfo", {
    jobId: currentJobInfo.jobId,
  });

  if (!namespace || !pod) {
    log("[shell] Namespace or pod not obtained, please check the adapter version");
    ws.close(0, "Namespace or pod not obtained, please check the adapter version");
    return;
  }

  try {
    const kc = new k8sClient.KubeConfig();
    kc.loadFromFile("/etc/scow/ai/kube/config");
    const k8sWs = await new k8sClient.Exec(kc)
      .exec(namespace, pod, "", ["/bin/sh"], stdoutStream, stderrStream, stdinStream, true);

    log("Connected to shell");

    // 调整窗口
    const cols = query.get("cols");
    const rows = query.get("rows");

    if (cols && rows) {
      stdinStream.write(
        `stty cols ${queryToIntOrDefault(cols, 80)} rows ${queryToIntOrDefault(rows, 30)}\n`);
    }
  
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

