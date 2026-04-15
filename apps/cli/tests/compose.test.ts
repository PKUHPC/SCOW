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

import { statSync } from "fs";
import { join } from "path";
import { createComposeSpec } from "src/compose";
import { AuthCustomType, getInstallConfig } from "src/config/install";
import { configPath, createInstallYaml, testBaseFolder } from "tests/utils";

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
  config.mis = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
  config.ai = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };

  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["portal-web"].environment).toContain("MIS_URL=/mis");
  expect(composeConfig.services["portal-web"].environment).toContain("MIS_SERVER_URL=mis-server:5000");
  expect(composeConfig.services["mis-web"].environment).toContain("PORTAL_URL=/");
  expect(composeConfig.services.ai.environment).toContain("MIS_URL=/mis");
  expect(composeConfig.services.ai.environment).toContain("MIS_SERVER_URL=mis-server:5000");
});

it("sets proxy_read_timeout", async () => {
  const config = getInstallConfig(configPath);
  config.gateway.proxyReadTimeout = "100";

  const composeSpec = createComposeSpec(config);

  expect(composeSpec.services.gateway.environment)
    .toInclude(`PROXY_READ_TIMEOUT=${config.gateway.proxyReadTimeout}`);
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
            "CUSTOM_AUTH_KEY": "CUSTOM_AUTH_VALUE",
          },
        },
      },
    });

    const spec = createComposeSpec(getInstallConfig(configPath));

    expect(spec.services.auth.environment)
      .toInclude("CUSTOM_AUTH_KEY=CUSTOM_AUTH_VALUE");
  });

  it("accepts array", async () => {
    const configPath = await createInstallYaml({
      auth: {
        custom: {
          type: AuthCustomType.image,
          image: {
            imageName: "",
          },
          environment: [
            "CUSTOM_AUTH_KEY=CUSTOM_AUTH_VALUE",
          ],
        },
      },
    });

    const spec = createComposeSpec(getInstallConfig(configPath));

    expect(spec.services.auth.environment)
      .toInclude("CUSTOM_AUTH_KEY=CUSTOM_AUTH_VALUE");
  });
});


it("deploy audit", async () => {
  const config = getInstallConfig(configPath);
  config.audit = { dbPassword: "must!chang3this", mysqlImage: "" };
  config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
  config.mis = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };

  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["mis-web"].environment).toContain("AUDIT_DEPLOYED=true");
  expect(composeConfig.services["portal-web"].environment).toContain("AUDIT_DEPLOYED=true");
});


it("deploy ai", async () => {
  const config = getInstallConfig(configPath);
  config.ai = { enabled: true, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };
  config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
  config.mis = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };

  const composeConfig = createComposeSpec(config);

  expect(composeConfig.services["mis-web"].environment).toContain("AI_URL=/ai");
});

describe("module enabled=false", () => {

  it("portal disabled: services absent and env vars correct", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: false, basePath: "/", novncClientImage: "" };
    config.mis = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
    config.ai = { enabled: true, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };

    const spec = createComposeSpec(config);

    // portal services should not be present
    expect(spec.services["portal-server"]).toBeUndefined();
    expect(spec.services["portal-web"]).toBeUndefined();
    expect(spec.services["novnc"]).toBeUndefined();

    // gateway should report portal as disabled
    expect(spec.services.gateway.environment).toContain("PORTAL_ENABLED=false");

    // mis-web should report portal as not deployed
    expect(spec.services["mis-web"].environment).toContain("PORTAL_DEPLOYED=false");

    // ai should report portal as not deployed
    expect(spec.services.ai.environment).toContain("PORTAL_DEPLOYED=false");
  });

  it("mis disabled: services absent and env vars correct", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
    config.mis = { enabled: false, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
    config.ai = { enabled: true, basePath: "/ai", dbPassword: "must!chang3this", mysqlImage: "" };

    const spec = createComposeSpec(config);

    // mis services should not be present
    expect(spec.services["mis-server"]).toBeUndefined();
    expect(spec.services["mis-web"]).toBeUndefined();
    expect(spec.services["db"]).toBeUndefined();

    // gateway should report mis as disabled
    expect(spec.services.gateway.environment).toContain("MIS_ENABLED=false");

    // portal-server and portal-web should report mis as not deployed
    expect(spec.services["portal-server"].environment).toContain("MIS_DEPLOYED=false");
    expect(spec.services["portal-server"].environment).toContain("MIS_SERVER_URL=");
    expect(spec.services["portal-web"].environment).toContain("MIS_DEPLOYED=false");
    expect(spec.services["portal-web"].environment).toContain("MIS_SERVER_URL=");

    // ai should report mis as not deployed
    expect(spec.services.ai.environment).toContain("MIS_DEPLOYED=false");
    expect(spec.services.ai.environment).toContain("MIS_SERVER_URL=");
  });

  it("ai disabled: services absent and env vars correct", async () => {
    const config = getInstallConfig(configPath);
    config.portal = { enabled: true, basePath: "/", novncClientImage: "" };
    config.mis = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
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
    config.mis = { enabled: true, basePath: "/mis", dbPassword: "must!chang3this", mysqlImage: "" };
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
