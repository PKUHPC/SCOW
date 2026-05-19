import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { loggedExec, sftpWriteFile } from "@scow/lib-ssh";
import { dirname } from "path";
import { configClusters } from "src/config/clusters";
import { config } from "src/config/env";
import { sshConnect } from "src/utils/ssh";
import { Logger } from "ts-log";

export const setupProxyGateway = async (logger: Logger, activatedClusters: Record<string, ClusterConfigSchema>) => {
  let portalBasePath = config.PORTAL_BASE_PATH;
  if (!portalBasePath.endsWith("/")) {
    portalBasePath += "/";
  }

  for (const id of Object.keys(activatedClusters)) {
    const proxyGatewayConfig = configClusters[id].proxyGateway;

    if (!proxyGatewayConfig?.autoSetupNginx) {
      continue;
    }

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

  location ~ ^${portalBasePath}api/proxy/(?<clusterId>.*)/relative/(?<node>[\\d|\\.]*)/(?<port>\\d+)(?<rest>.*)$ {
    proxy_pass http://$node:$port$rest$is_args$args;
  }

  location ~ ^${portalBasePath}api/proxy/(?<clusterId>.*)/absolute/(?<node>[\\d|\\.]*)/(?<port>\\d+)(?<rest>.*)$ {
      proxy_pass http://$node:$port$request_uri;
  }
}
    `;

    const nginxConfigPath = "/etc/nginx/conf.d/scow-portal-proxy-gateway.conf";

    await sshConnect(url.hostname, "root", logger, async (ssh) => {
      // check if nginx is installed
      const resp = await loggedExec(ssh, logger, false, "nginx", ["-v"]);

      if (resp.code !== 0) {
        logger.error("nginx -v returned code %d. nginx might not be installed on %s", resp.code, url.host);
        return;
      }

      const sftp = await ssh.requestSFTP();
      await ssh.mkdir(dirname(nginxConfigPath), "exec", sftp);
      await sftpWriteFile(sftp)(nginxConfigPath, content);

      await loggedExec(ssh, logger, true, "nginx", ["-s", "reload"]);

      logger.info("Successfully setup proxy gateway for cluster %s", id);
    }).catch((e) => {
      logger.error(e, "Error occurred during setup proxy gateway for cluster %s", id);
    });
  }
};

export const parseIp = (stdout: string): string => {
  const ipReg = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;
  return ipReg.exec(stdout.split("\n")[0])?.[0] ?? "";
};

export const getIpFromProxyGateway = async (clusterId: string, hostName: string, logger: Logger): Promise<string> => {
  const proxyGatewayConfig = configClusters?.[clusterId]?.proxyGateway;

  if (!proxyGatewayConfig) return "";
  const url = new URL(proxyGatewayConfig.url);

  return await sshConnect(url.hostname, "root", logger, async (ssh) => {
    const resp = await loggedExec(ssh, logger, false, "ping", ["-c 1", "-W 1", hostName]);
    if (resp.code !== 0) {
      logger.error(
        "Ping %s returned code %d. %s might not be reachable from %s",
        hostName,
        resp.code,
        hostName,
        url.hostname,
      );
      return "";
    }
    const ip = parseIp(resp.stdout);
    return ip;
  }).catch((e) => {
    logger.error(
      e,
      "Error occurred during get ip of host %s from proxy gateway %s for cluster %s",
      hostName,
      url.host,
      clusterId,
    );
    return "";
  });
};
