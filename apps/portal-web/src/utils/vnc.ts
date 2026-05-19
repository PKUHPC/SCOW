import { joinWithUrl } from "@scow/utils";
import { join } from "path";
import { publicConfig } from "src/utils/config";

export const openDesktop = (clusterId: string, node: string, port: number, password: string) => {
  const params = new URLSearchParams({
    path: join(publicConfig.BASE_PATH, "/api/proxy", clusterId, "absolute", node, String(port)),
    host: location.hostname,
    port: location.port,
    password: password,
    autoconnect: "true",
    reconnect: "true",
    resize: "remote",
  });

  const vncUrl = joinWithUrl(publicConfig.NOVNC_CLIENT_URL, "/vnc.html");
  window.open(vncUrl + "?" + params.toString(), "_blank");
};
