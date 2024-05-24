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

import { getLoginNode } from "@scow/config/build/cluster";
import { normalizePathnameWithQuery } from "@scow/utils";
import httpProxy from "http-proxy";
import { NextApiRequest } from "next";
import { join } from "path";
import { checkCookie } from "src/auth/server";
import { publicConfig, runtimeConfig } from "src/utils/config";

/**
 * Parse proxy target
 * @param url req.url
 * @param urlIncludesBasePath whether url.req includes base path already
 * @returns Parsed proxy targe
 */
export function parseProxyTarget(url: string, urlIncludesBasePath: boolean): string | Error {

  const normalizedUrl = normalizePathnameWithQuery(url);

  const basePath = publicConfig.BASE_PATH;

  // skip base path
  const relativePath = urlIncludesBasePath
    ? basePath === "/"
      ? normalizedUrl
      : normalizedUrl.slice(basePath.length)
    : normalizedUrl;

  const [_empty, _api, _proxy, clusterId, type, node, port, ...path] = relativePath.split("/");

  if (!runtimeConfig.CLUSTERS_CONFIG[clusterId]) {
    return new Error("Invalid clusterId");
  }

  const fullUri = `${(urlIncludesBasePath || basePath === "/") ? "" : basePath}${url}`;

  const proxyGateway = runtimeConfig.CLUSTERS_CONFIG[clusterId].proxyGateway;
  const loginNodes = runtimeConfig.CLUSTERS_CONFIG[clusterId].loginNodes.map((x) => getLoginNode(x).address);

  console.log("console relativePath", relativePath);
  console.log("console fullUri", fullUri);

  // if node is login node, not proxy to proxy gateway node
  if (proxyGateway && !loginNodes.includes(node)) {
    // proxy to proxy gateway node
    console.log("console proxyGateway.url", `${proxyGateway.url}${fullUri}`);
    return `${proxyGateway.url}${fullUri}`;
  }

  // connect directly to compute node
  if (type === "relative") {
    return `http://${node}:${port}/${path.join("/")}`;
  } else if (type === "absolute") {
    return `http://${node}:${port}${fullUri}`;
  } else {
    return new Error("type is not absolute or relative");
  }
}

export const proxy = httpProxy.createServer();


/**
 * Node的原生http服务器（http.Server）在收到WebSocket连接的时候将会触发一个`upgrade`事件，而且并不走正常的HTTP请求响应流程
 * 所以整个系统第一次启动后，在以HTTP形式访问此代理地址之前，到本地址的WebSocket将会失败
 * 因为此时并没有注册upgrade事件的监听器，无法处理WebSocket连接。
 *
 * 所以系统启动后，需要手动触发一次到本地址的HTTP请求，以便注册upgrade事件的监听器
 */
export const setupWssProxy = (req: NextApiRequest) => {
  (req.socket as any).server.on("upgrade", async (req, socket, head) => {

    const url = normalizePathnameWithQuery(req.url!);

    if (!url.startsWith(join(publicConfig.BASE_PATH, "/api/proxy"))) {
      return;
    }

    const writeError = (statusLine: string, msg: string) => {
      socket.end(`HTTP/1.1 ${statusLine}\r\n${msg}`);
    };

    const user = await checkCookie(() => true, req).catch(() => {
      writeError("500 Internal Server Error", "Error when authenticating request");
      return 500;
    });

    if (typeof user === "number") {
      writeError("401 Unauthorized", "token is not valid");
      return;
    }

    // req.url of raw node.js request object doesn't remove base path
    const target = parseProxyTarget(req.url!, true);

    if (target instanceof Error) {
      writeError("400 Bad Request", target.message);
      return;
    }

    proxy.ws(req, socket, head, { target, ignorePath: true, xfwd: true }, (err) => {
      console.error(err, "Error when proxing WS requests");
      writeError("500 Internal Server Error", "Error when proxing WS requests");
    });

  });

};

