import { getClusterConfigs } from "@scow/config/build/cluster";
import { PlatformRole } from "@scow/protos/build/server/user";
import { joinWithUrl } from "@scow/utils";
import httpProxy from "http-proxy";
import { NextApiRequest, NextApiResponse } from "next";
import { authenticate } from "src/auth/server";
import { publicConfig } from "src/utils/config";
import { DEFAULT_GRAFANA_URL } from "src/utils/constants";

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
});

proxy.on("proxyReq", function (proxyReq, req) {
  if (req.body) {
    const bodyData = JSON.stringify(req.body);

    proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));

    if (req.headers.host) {
      proxyReq.setHeader("Host", req.headers.host);
    }

    proxyReq.write(bodyData);
  }
});

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (!publicConfig.CLUSTER_MONITOR.resourceStatus.enabled) {
    return res.status(404).send("Resource status is not enabled");
  }

  const { path, cluster, ...rest } = req.query;
  const pathSegments = path ? (Array.isArray(path) ? path : [path]) : [];
  const panelId = Array.isArray(rest.panelId) ? rest.panelId[0] : rest.panelId;
  const varJobName = Array.isArray(rest["var-job_name"]) ? rest["var-job_name"][0] : rest["var-job_name"];
  const acceptHeader = Array.isArray(req.headers.accept) ? req.headers.accept[0] : req.headers.accept;
  const acceptsHtml = typeof acceptHeader === "string" && acceptHeader.includes("text/html");
  const isSoloDashboard = pathSegments[0] === "d-solo";
  const isFullDashboard = pathSegments[0] === "d";
  const isHtmlRequest = acceptsHtml || isSoloDashboard || isFullDashboard || pathSegments.length === 0;

  /**
   * 普通用户：
   * 1. 仅允许 d-solo
   * 2. dashboard和panel 匹配（dashboardId/dashboardName/panelId）
   * 3. varJobName必传
   * 管理员：允许 d（并且也能访问 d-solo）。
   */
  if (isHtmlRequest) {
    const configClusters = isSoloDashboard ? getClusterConfigs(undefined, console) : {};
    const clusterId = Array.isArray(cluster) ? cluster[0] : cluster;

    const matchJobMonitor = (
      jobMonitor: { dashboardId: string; dashboardName: string; panelIds: Record<string, number> } | undefined,
      segments: string[],
      targetPanelId: string | undefined,
      targetVarJobName: string | undefined,
    ) => {
      if (!jobMonitor || !targetPanelId || !targetVarJobName) {
        return false;
      }

      const [first, second, third] = segments;
      if (first !== "d-solo" || second !== jobMonitor.dashboardId || third !== jobMonitor.dashboardName) {
        return false;
      }

      const allowedPanelIds = Object.values(jobMonitor.panelIds).map(String);
      return allowedPanelIds.includes(String(targetPanelId));
    };

    const aiMonitorMatched =
      isSoloDashboard && clusterId
        ? matchJobMonitor(configClusters[clusterId]?.jobMonitor, pathSegments, panelId, varJobName)
        : false;

    const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) || aiMonitorMatched);
    const info = await auth(req, res);
    if (!info) {
      return;
    }
  }
  // 其它请求（/api/、/public/ 等静态资源）只验证是否登录
  else {
    const auth = authenticate(() => true);
    const info = await auth(req, res);

    if (!info) {
      return;
    }
  }

  const grafanaPath = path ? (Array.isArray(path) ? path.join("/") : path) : "/";

  const queryString = new URLSearchParams(rest as Record<string, string>).toString();
  const urlWithQuery = queryString ? `?${queryString}` : "";

  const grafanaUrl = publicConfig.CLUSTER_MONITOR.grafanaUrl ?? DEFAULT_GRAFANA_URL;
  const target = joinWithUrl(grafanaUrl, grafanaPath) + urlWithQuery;

  proxy.web(
    req,
    res,
    {
      target,
      xfwd: true,
      ignorePath: true,
    },
    (err) => {
      if (err) {
        console.error(err, "Error when proxing requests");
        res.status(500).send(err);
      }
    },
  );
};
