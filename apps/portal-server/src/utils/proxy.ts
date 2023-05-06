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

import { loggedExec, sftpMkdir, sftpWriteFile } from "@scow/lib-ssh";
import { dirname } from "path";
import { clusters } from "src/config/clusters";
import { config } from "src/config/env";
import { sshConnect } from "src/utils/ssh";
import { Logger } from "ts-log";

export const setupProxyGateway = async (logger: Logger) => {

  let portalBasePath = config.PORTAL_BASE_PATH;
  if (!portalBasePath.endsWith("/")) { portalBasePath += "/"; }

  for (const id of Object.keys(clusters)) {

    const proxyGatewayConfig = clusters[id].proxyGateway;

    if (!proxyGatewayConfig?.autoSetupNginx) { continue; }

    logger.info("Setup proxy gateway for cluster %s", id);

    const url = new URL(proxyGatewayConfig.url);

    const content = `
server {
  listen ${url.port};

  proxy_set_header Host   $http_host;
  proxy_set_header X-Real-IP      $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";

  location ~ ^${portalBasePath}api/proxy/(?<clusterId>.*)/relative/(?<node>[\d|\.]*)/(?<port>\d+)(?<rest>.*)$ {
    proxy_pass http://$node:$port$rest$is_args$args;
  }

  location ~ ^${portalBasePath}api/proxy/(?<clusterId>.*)/absolute/(?<node>[\d|\.]*)/(?<port>\d+)(?<rest>.*)$ {
      proxy_pass http://$node:$port$request_uri;
  }
}
    `;

    const nginxConfigPath = "/etc/nginx/conf.d/scow-portal-proxy-gateway.conf";

    await sshConnect(url.host, "root", logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();
      await sftpMkdir(sftp)(dirname(nginxConfigPath));
      await sftpWriteFile(sftp)(nginxConfigPath, content);

      await loggedExec(ssh, logger, true, "nginx", ["-s", "reload"]);
    }).catch((e) => {
      logger.error(e, "Error occurred during setup proxy gateway for cluster %s", id);
    });
  }



};
