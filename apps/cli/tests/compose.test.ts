import { getCommonConfig } from "@scow/config/build/common";
import { rmSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { createComposeSpec } from "src/compose";
import { AuthCustomType, getInstallConfig } from "src/config/install";
import { configPath, createInstallYaml, testBaseFolder } from "tests/utils";

it("applies required subsystem defaults to minimal install config", async () => {
  const minimalConfigPath = await createInstallYaml({});
  const config = getInstallConfig(minimalConfigPath);

  expect(config.mis.basePath).toBe("/mis");
  expect(config.audit.mysqlImage).toBe("mysql:8");
  expect(config.resource.basePath).toBe("/resource");
  expect(config.notification.basePath).toBe("/notification");
  expect(config.metaServer.enabled).toBe(true);
});

it("uses the default scheduler adapter timeout", async () => {
  const configPath = await createInstallYaml({ adapter: {} });
  const config = getInstallConfig(configPath);
  const composeConfig = createComposeSpec(config);

  expect(config.adapter?.timeoutSeconds).toBe(60);
  expect(composeConfig.services["mis-server"].environment).toContain("ADAPTER_TIMEOUT_SECONDS=60");
  expect(composeConfig.services.resource.environment).toContain("ADAPTER_TIMEOUT_SECONDS=60");
});

it("uses the configured scheduler adapter timeout", async () => {
  const configPath = await createInstallYaml({
    adapter: { timeoutSeconds: 180 },
  });
  const config = getInstallConfig(configPath);
  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["mis-server"].environment).toContain("ADAPTER_TIMEOUT_SECONDS=180");
  expect(composeConfig.services.resource.environment).toContain("ADAPTER_TIMEOUT_SECONDS=180");
});

it.each([
  ["zero", 0],
  ["a negative number", -1],
  ["a decimal", 1.5],
])("rejects %s as an adapter timeout", async (_, timeoutSeconds) => {
  const configPath = await createInstallYaml({ adapter: { timeoutSeconds } });

  expect(() => getInstallConfig(configPath)).toThrow();
});

it("accepts but ignores removed install switches", async () => {
  const legacyConfigPath = await createInstallYaml({ mis: { enabled: false } });
  const config = getInstallConfig(legacyConfigPath);
  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["mis-server"]).toBeDefined();
  expect(composeConfig.services["mis-web"]).toBeDefined();
  expect(composeConfig.services.db).toBeDefined();
});

it("accepts but ignores removed common switches", async () => {
  await writeFile(
    join(testBaseFolder, "common.yaml"),
    [
      "passwordPattern:",
      "  regex: test",
      "  errorMessage: test",
      "scowApi:",
      "  auth:",
      "    token: test-scow-api-token-at-least-32-chars",
      "notification:",
      "  enabled: false",
      "scowResource:",
      "  enabled: false",
    ].join("\n"),
  );
  const commonConfig = getCommonConfig(testBaseFolder);
  expect(commonConfig.scowResource.address).toBe("http://resource:3000/resource");
  expect(commonConfig.notification).toMatchObject({
    name: "notification",
    address: "http://notification:3000/notification",
  });
});

it("requires the API token and applies required connection defaults", async () => {
  await writeFile(
    join(testBaseFolder, "common.yaml"),
    ["passwordPattern:", "  regex: test", "  errorMessage: test", "scowApi:", "  auth: {}"].join("\n"),
  );
  expect(() => getCommonConfig(testBaseFolder)).toThrow("/scowApi/auth must have required property 'token'");

  await writeFile(
    join(testBaseFolder, "common.yaml"),
    [
      "passwordPattern:",
      "  regex: test",
      "  errorMessage: test",
      "scowApi:",
      "  auth:",
      "    token: test-scow-api-token-at-least-32-chars",
    ].join("\n"),
  );
  const commonConfig = getCommonConfig(testBaseFolder);
  expect(commonConfig.scowResource.address).toBe("http://resource:3000/resource");
  expect(commonConfig.notification).toMatchObject({
    name: "notification",
    address: "http://notification:3000/notification",
  });
});

it("creates log dir for fluentd", async () => {
  const config = getInstallConfig(configPath);

  const logDir = join(testBaseFolder, "logdir");

  config.log.fluentd = { logDir, image: "fluentd:v1.14.0-1.0" };

  createComposeSpec(config);

  const s = statSync(logDir);

  expect(s.mode).toBe(0o40777);
});

it("generate correct paths", async () => {
  const config = getInstallConfig(configPath);

  config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
  config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
  config.ai = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };

  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["portal-web"].environment).toContain("MIS_URL=/mis");
  expect(composeConfig.services["portal-web"].environment).toContain("MIS_SERVER_URL=mis-server:5000");
  expect(composeConfig.services["mis-web"].environment).toContain("PORTAL_URL=/");
  expect(composeConfig.services.ai.environment).toContain("MIS_URL=/mis");
  expect(composeConfig.services.ai.environment).toContain("MIS_SERVER_URL=mis-server:5000");
});

it("sets quantum portal internal url with portal base path", async () => {
  const config = getInstallConfig(configPath);
  const generatedUchipConfigPath = join(process.cwd(), "config", "quantum", "uchip");

  config.basePath = "/scow";
  config.portal = { enabled: true, basePath: "/portal", novncClientImage: "" };
  config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
  config.quantum = {
    enabled: true,
    basePath: "/quantum",
    qobody: { image: "qobody:test", token: "test-token" },
  };

  rmSync(generatedUchipConfigPath, { recursive: true, force: true });

  try {
    const composeConfig = createComposeSpec(config);

    expect(composeConfig.services.quantum.environment).toContain("PORTAL_URL=/scow/portal");
    expect(composeConfig.services.quantum.environment).toContain(
      "PORTAL_INTERNAL_URL=http://portal-web:3000/scow/portal",
    );
  } finally {
    rmSync(generatedUchipConfigPath, { recursive: true, force: true });
  }
});

it("sets proxy_read_timeout", async () => {
  const config = getInstallConfig(configPath);
  config.gateway.proxyReadTimeout = "100";

  const composeSpec = createComposeSpec(config);

  expect(composeSpec.services.gateway.environment).toInclude(`PROXY_READ_TIMEOUT=${config.gateway.proxyReadTimeout}`);
  expect(composeSpec.services.gateway.environment).toContain("UNIFIED_WEB_ENABLED=false");
  expect(composeSpec.services.gateway.environment).toContain("UNIFIED_WEB_PATH=/unified");
});

it("uses the unified frontend setting from gateway config", async () => {
  const config = getInstallConfig(configPath);
  config.gateway.unifiedWebEnabled = true;

  const composeSpec = createComposeSpec(config);

  expect(composeSpec.services.gateway.environment).toContain("UNIFIED_WEB_ENABLED=true");
});

it("deploys meta-server with install config mounted", async () => {
  const config = getInstallConfig(configPath);

  const composeSpec = createComposeSpec(config);

  expect(composeSpec.services["meta-server"].environment).toContain("SCOW_LAUNCH_APP=meta-server");
  expect(composeSpec.services["meta-server"].environment).toContain("INSTALL_CONFIG_PATH=/etc/scow/install.yaml");
  expect(composeSpec.services["meta-server"].volumes).toContain("./install.yaml:/etc/scow/install.yaml");
  expect(composeSpec.services.gateway.environment).toContain("META_SERVER_ENABLED=true");
});

it("does not deploy meta-server when disabled", async () => {
  const config = getInstallConfig(configPath);
  config.metaServer.enabled = false;

  const composeSpec = createComposeSpec(config);

  expect(composeSpec.services["meta-server"]).toBeUndefined();
  expect(composeSpec.services.gateway.environment).toContain("META_SERVER_ENABLED=false");
});

describe("sets custom auth environment", () => {
  it("accepts object", async () => {
    const configPath = await createInstallYaml({
      auth: {
        custom: {
          type: AuthCustomType.image,
          image: {
            imageName: "",
          },
          environment: {
            CUSTOM_AUTH_KEY: "CUSTOM_AUTH_VALUE",
          },
        },
      },
    });

    const spec = createComposeSpec(getInstallConfig(configPath));

    expect(spec.services.auth.environment).toInclude("CUSTOM_AUTH_KEY=CUSTOM_AUTH_VALUE");
  });

  it("accepts array", async () => {
    const configPath = await createInstallYaml({
      auth: {
        custom: {
          type: AuthCustomType.image,
          image: {
            imageName: "",
          },
          environment: ["CUSTOM_AUTH_KEY=CUSTOM_AUTH_VALUE"],
        },
      },
    });

    const spec = createComposeSpec(getInstallConfig(configPath));

    expect(spec.services.auth.environment).toInclude("CUSTOM_AUTH_KEY=CUSTOM_AUTH_VALUE");
  });
});

it("always deploys required subsystems", async () => {
  const config = getInstallConfig(configPath);
  config.portal = { enabled: true, basePath: "/", novncClientImage: "" };

  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["mis-server"]).toBeDefined();
  expect(composeConfig.services["mis-web"]).toBeDefined();
  expect(composeConfig.services.db).toBeDefined();
  expect(composeConfig.services["audit-server"]).toBeDefined();
  expect(composeConfig.services["audit-db"]).toBeDefined();
  expect(composeConfig.services.notification).toBeDefined();
  expect(composeConfig.services.resource).toBeDefined();
  expect(composeConfig.services.gateway.environment).not.toContain("MIS_ENABLED");
});

it("deploy ai", async () => {
  const config = getInstallConfig(configPath);
  config.ai = { enabled: true, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };
  config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
  config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };

  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["mis-web"].environment).toContain("AI_URL=/ai");
});

describe("VNC (novnc) service", () => {
  it("is present when portal is enabled", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "" };

    const spec = createComposeSpec(config);

    expect(spec.services["novnc"]).toBeDefined();
    expect(spec.services.gateway.environment).toContain("VNC_ENABLED=true");
  });

  it("is present when only ai is enabled and portal is disabled", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: false, basePath: "/", novncClientImage: "" };
    config.ai = { enabled: true, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };

    const spec = createComposeSpec(config);

    expect(spec.services["novnc"]).toBeDefined();
    expect(spec.services.gateway.environment).toContain("VNC_ENABLED=true");
  });

  it("is absent when both portal and ai are disabled", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: false, basePath: "/", novncClientImage: "" };
    config.ai = { enabled: false, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };
    config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };

    const spec = createComposeSpec(config);

    expect(spec.services["novnc"]).toBeUndefined();
    expect(spec.services.gateway.environment).toContain("VNC_ENABLED=false");
  });

  it("uses novnc.novncClientImage over portal.novncClientImage", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "portal-novnc:v1" };
    config.novnc = { novncClientImage: "top-level-novnc:v2" };

    const spec = createComposeSpec(config);

    expect(spec.services["novnc"].image).toBe("top-level-novnc:v2");
  });

  it("falls back to portal.novncClientImage when novnc is not configured", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "portal-novnc:v1" };
    config.novnc = undefined;

    const spec = createComposeSpec(config);

    expect(spec.services["novnc"].image).toBe("portal-novnc:v1");
  });
});

describe("module enabled=false", () => {
  it("portal disabled: services absent and env vars correct", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: false, basePath: "/", novncClientImage: "" };
    config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
    config.ai = { enabled: true, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };

    const spec = createComposeSpec(config);

    // portal services should not be present
    expect(spec.services["portal-server"]).toBeUndefined();
    expect(spec.services["portal-web"]).toBeUndefined();
    // novnc is still present because ai is enabled
    expect(spec.services["novnc"]).toBeDefined();

    // gateway should report portal as disabled
    expect(spec.services.gateway.environment).toContain("PORTAL_ENABLED=false");

    // mis-web should report portal as not deployed
    expect(spec.services["mis-web"].environment).toContain("PORTAL_DEPLOYED=false");

    // ai should report portal as not deployed
    expect(spec.services.ai.environment).toContain("PORTAL_DEPLOYED=false");
  });

  it("ai disabled: services absent and env vars correct", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
    config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
    config.ai = { enabled: false, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };

    const spec = createComposeSpec(config);

    // ai services should not be present
    expect(spec.services["ai"]).toBeUndefined();
    expect(spec.services["ai-db"]).toBeUndefined();

    // gateway should report ai as disabled
    expect(spec.services.gateway.environment).toContain("AI_ENABLED=false");

    // portal-web should report ai as not deployed
    expect(spec.services["portal-web"].environment).toContain("AI_DEPLOYED=false");

    // mis-web should report ai as not deployed
    expect(spec.services["mis-web"].environment).toContain("AI_DEPLOYED=false");
  });

  it("quantum disabled: services absent and env vars correct", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
    config.mis = { basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
    config.quantum = {
      enabled: false,
      basePath: "/quantum",
      qobody: { image: "", token: "test-token" },
    };

    const spec = createComposeSpec(config);

    // quantum services should not be present
    expect(spec.services["quantum"]).toBeUndefined();
    expect(spec.services["qobody"]).toBeUndefined();

    // gateway should report quantum as disabled
    expect(spec.services.gateway.environment).toContain("QUANTUM_ENABLED=false");

    // portal-web should report quantum as not deployed
    expect(spec.services["portal-web"].environment).toContain("QUANTUM_DEPLOYED=false");

    // mis-web should report quantum as not deployed
    expect(spec.services["mis-web"].environment).toContain("QUANTUM_DEPLOYED=false");

    // mis-server should report quantum as not deployed
    expect(spec.services["mis-server"].environment).toContain("QUANTUM_DEPLOYED=false");
  });
});
