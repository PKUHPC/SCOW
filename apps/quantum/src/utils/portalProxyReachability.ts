import type { NextApiRequest } from "next";

import { joinWithUrl } from "@scow/utils";
import { config } from "src/server/config/env";
import { logger } from "src/server/utils/logger";

const getPortalInternalBaseUrl = (): URL | undefined => {
  const portalInternalUrl = config.PORTAL_INTERNAL_URL;

  if (!portalInternalUrl) {
    return undefined;
  }

  if (portalInternalUrl.startsWith("http://") || portalInternalUrl.startsWith("https://")) {
    return new URL(portalInternalUrl);
  }

  return undefined;
};

export async function isWebAppReachableThroughPortalProxy({
  req,
  timeout,
  clusterId,
  host,
  port,
  proxyType,
}: {
  req: NextApiRequest;
  timeout: number;
  clusterId: string;
  host: string;
  port: number;
  proxyType: "relative" | "absolute";
}): Promise<boolean> {
  const portalBaseUrl = getPortalInternalBaseUrl();

  if (!portalBaseUrl) {
    logger.warn(
      "Unable to get portal internal URL when checking quantum Jupyter app connectivity. Please configure PORTAL_INTERNAL_URL.",
    );
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const checkUrl = joinWithUrl(portalBaseUrl.toString(), "/api/proxy", clusterId, proxyType, host, String(port));

    const response = await fetch(checkUrl, {
      headers: {
        Cookie: req.headers.cookie || "",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    // 沿用 portal 的连通性语义：502 表示 proxy 未能连到目标节点端口。
    // 这里判断的是端口入口是否可达，不按 response.ok 判断应用自身的业务状态码。
    return response.status !== 502;
  } catch (e) {
    logger.warn(
      { err: e, clusterId, host, port, proxyType },
      "Failed to request portal proxy when checking quantum Jupyter app connectivity.",
    );
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
