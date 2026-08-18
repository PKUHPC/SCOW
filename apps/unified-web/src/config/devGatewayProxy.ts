export const DEV_GATEWAY_PROXY_PREFIX = "/__gateway__";

export const getDevGatewayResourceUrl = (resourceUrl: string, gatewayUrl: string) => {
  try {
    const resource = new URL(resourceUrl);
    const gateway = new URL(gatewayUrl);
    if (resource.origin !== gateway.origin) return resourceUrl;

    return `${DEV_GATEWAY_PROXY_PREFIX}${resource.pathname}${resource.search}${resource.hash}`;
  } catch {
    return resourceUrl;
  }
};
