import ConfigParser from "@webantic/nginx-config-parser";
import { join } from "path";
import { config } from "src/env";
import { getNginxConfig } from "src/parse";

const parser = new ConfigParser();

function parseNginxConfig(envConfig: typeof config) {
  const nginxConf = getNginxConfig(envConfig);
  return parser.parse(nginxConf);
}

function expectDirectiveBefore(nginxConf: string, first: string, second: string) {
  expect(nginxConf.indexOf(first)).toBeGreaterThanOrEqual(0);
  expect(nginxConf.indexOf(second)).toBeGreaterThan(nginxConf.indexOf(first));
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

it("generates meta proxy location", async () => {
  const nginxConf = parseNginxConfig(config);

  expect(nginxConf.server["location /meta"]).toMatchObject({
    set: `$meta_server ${config.META_SERVER_URL}`,
    proxy_pass: "$meta_server",
  });
});

it("generates meta proxy location with custom base path", async () => {
  const nginxConf = parseNginxConfig({ ...config, BASE_PATH: "/scow" });

  expect(nginxConf.server["location /scow/meta"]).toMatchObject({
    set: `$meta_server ${config.META_SERVER_URL}`,
    proxy_pass: "$meta_server",
  });
});

it("does not expose unified web preview by default", () => {
  const nginxConf = getNginxConfig({ ...config, UNIFIED_WEB_ENABLED: false });

  expect(nginxConf).not.toContain("/unified/index.html");
  expect(nginxConf).not.toContain("/api/unified/portal/");
});

it("serves unified web preview and rewrites root portal api without duplicate api segments", () => {
  const nginxConf = getNginxConfig({
    ...config,
    BASE_PATH: "",
    PORTAL_PATH: "/",
    UNIFIED_WEB_ENABLED: true,
  });

  expect(nginxConf).toContain("location /api/unified/portal/");
  expect(nginxConf).toContain("rewrite ^/api/unified/portal/(.*)$ /api/$1 break;");
  expect(nginxConf).toContain("location /api/unified/mis/");
  expect(nginxConf).toContain("rewrite ^/api/unified/mis/(.*)$ /mis/api/$1 break;");
  expect(nginxConf).toContain("location /api/unified/notification/");
  expect(nginxConf).not.toContain("location /api/notification/");
  expect(nginxConf).not.toContain("/api/api/");
  expectDirectiveBefore(nginxConf, "set $portal_path_url", "rewrite ^/api/unified/portal/");
  expectDirectiveBefore(nginxConf, "set $mis_path_url", "rewrite ^/api/unified/mis/");
  expectDirectiveBefore(nginxConf, "set $ai_path_url", "rewrite ^/api/unified/ai/");
  expectDirectiveBefore(nginxConf, "set $notification_path_url", "rewrite ^/api/unified/notification/");
  expectDirectiveBefore(nginxConf, "set $quantum_path_url", "rewrite ^/api/unified/quantum/");
  expect(nginxConf).toContain("location /unified/");
  expect(nginxConf).toContain("try_files $uri $uri/ /unified/index.html;");
});

it("does not expose the unified MIS API when MIS is disabled", () => {
  const nginxConf = getNginxConfig({
    ...config,
    MIS_ENABLED: false,
    UNIFIED_WEB_ENABLED: true,
  });

  expect(nginxConf).not.toContain("location /api/unified/mis/");
});

it("rewrites unified api routes with a custom base path", () => {
  const nginxConf = getNginxConfig({
    ...config,
    BASE_PATH: "/scow",
    PORTAL_PATH: "/",
    MIS_PATH: "/mis",
    AI_PATH: "/ai",
    UNIFIED_WEB_ENABLED: true,
  });

  expect(nginxConf).toContain("rewrite ^/scow/api/unified/portal/(.*)$ /scow/api/$1 break;");
  expect(nginxConf).toContain("rewrite ^/scow/api/unified/mis/(.*)$ /scow/mis/api/$1 break;");
  expect(nginxConf).toContain("rewrite ^/scow/api/unified/ai/(.*)$ /scow/ai/api/$1 break;");
  expect(nginxConf).toContain("location /scow/unified/");
});
