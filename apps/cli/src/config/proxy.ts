import { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "src/config/env";

export const proxyUrl = config.HTTPS_PROXY || config.https_proxy || config.HTTP_PROXY || config.http_proxy;

export const createProxyAgent = (proxyUrl: string) => {
  return new HttpsProxyAgent(proxyUrl);
};
