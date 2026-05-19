import ConfigParser from "@webantic/nginx-config-parser";
import { join } from "path";
import { config } from "src/env";
import { getNginxConfig } from "src/parse";

const parser = new ConfigParser();

function parseNginxConfig(envConfig: typeof config) {
  const nginxConf = getNginxConfig(envConfig);
  return parser.parse(nginxConf);
}

it("parses nginx config", () => {
  const nginxConf = parseNginxConfig(config);

  expect(nginxConf.server.listen).toBe("80");
});

it("configures proxy_read_timeout", async () => {
  const nginxConf = parseNginxConfig(config);

  expect(nginxConf.server.proxy_read_timeout).toBe(config.PROXY_READ_TIMEOUT);
});

it("generates static files location", async () => {
  const nginxConf = parseNginxConfig(config);

  expect(nginxConf.server[`location ${join(config.BASE_PATH, config.PUBLIC_PATH)}`]).toEqual({
    alias: config.PUBLIC_DIR,
    autoindex: "off",
  });
});

it("generates VNC proxy location when VNC_ENABLED is true", async () => {
  const nginxConf = parseNginxConfig({ ...config, VNC_ENABLED: true });

  expect(nginxConf.server[`location ${config.VNC_PATH}`]).toBeDefined();
});

it("does not generate VNC proxy location when VNC_ENABLED is false", async () => {
  const nginxConf = parseNginxConfig({ ...config, VNC_ENABLED: false });

  expect(nginxConf.server[`location ${config.VNC_PATH}`]).toBeUndefined();
});
