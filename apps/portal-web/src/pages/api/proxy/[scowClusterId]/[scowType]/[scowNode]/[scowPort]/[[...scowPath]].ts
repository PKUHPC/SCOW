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

import { NextApiRequest, NextApiResponse } from "next";
import { checkCookie } from "src/auth/server";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { parseProxyTarget, proxy } from "src/server/setup/proxy";

export default async (req: NextApiRequest, res: NextApiResponse) => {

  const user = await checkCookie(() => true, req).catch(() => {
    res.status(500).send("Error when authenticating request");
    return 500;
  });

  if (typeof user === "number") {
    res.status(401).send("Unauthorized");
    return;
  }

  const clusterConfigs = await getClusterConfigFiles();

  // req.url of next.js removes base path
  const target = parseProxyTarget(req.url!, false, clusterConfigs);

  if (target instanceof Error) {
    res.status(400).send(target.message);
    return;
  }

  proxy.web(req, res, {
    target,
    ignorePath: true, xfwd: true,
  }, (err) => {

    if (!err) { return; }
    console.error(err, "Error when proxying requests");

    // 如果节点解析失败 或者 节点:端口不可连接
    if ((err.message.includes("getaddrinfo") && err.message.includes("ENOTFOUND")) || 
    (err.message.includes("ECONNREFUSED"))) {
      return res.status(502).send(err);
    } else {
      res.status(500).send(err);
    }
  });


};


export const config = {
  api: {
    bodyParser: false,
  },
};
