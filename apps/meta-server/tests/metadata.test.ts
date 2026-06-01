import { InstallConfigSchema } from "@scow/config/build/install";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getMetadata } from "src/metadata";
import { createMetaServer, stripBasePath, stripMetaBasePath } from "src/server";

it("returns enabled component base paths with system base path", () => {
  const metadata = getMetadata({
    basePath: "/scow",
    portal: { enabled: true, basePath: "/" },
    mis: { enabled: true, basePath: "/mis" },
    ai: { enabled: false, basePath: "/ai" },
    quantum: { enabled: true, basePath: "/quantum" },
    notification: { basePath: "/notification" },
    resource: { basePath: "/resource" },
  } as InstallConfigSchema);

  expect(metadata).toEqual({
    basePath: "/scow",
    version: "1.11.1",
    components: {
      portal: "/scow",
      mis: "/scow/mis",
      ai: undefined,
      quantum: "/scow/quantum",
      notification: "/scow/notification",
      resource: "/scow/resource",
    },
  });
});

it("strips meta-server base path from request paths", () => {
  expect(stripMetaBasePath("/meta")).toBe("/");
  expect(stripMetaBasePath("/meta/openapi")).toBe("/openapi");
  expect(stripMetaBasePath("/meta/api/openapi.json")).toBe("/api/openapi.json");
  expect(stripMetaBasePath("/api/openapi.json")).toBe("/api/openapi.json");
});

it("does not prefix component paths when system base path is root", () => {
  const metadata = getMetadata({
    basePath: "/",
    portal: { enabled: true, basePath: "/" },
    mis: { enabled: true, basePath: "/mis" },
  } as InstallConfigSchema);

  expect(metadata.components.portal).toBe("/");
  expect(metadata.components.mis).toBe("/mis");
});

it("strips custom base path from request paths", () => {
  expect(stripBasePath("/scow/meta", "/scow")).toBe("/meta");
  expect(stripBasePath("/scow/meta/openapi", "/scow")).toBe("/meta/openapi");
  expect(stripBasePath("/scow/meta/api/openapi.json", "/scow")).toBe("/meta/api/openapi.json");
  expect(stripBasePath("/meta", "/")).toBe("/meta");
  expect(stripBasePath("/other/meta", "/scow")).toBe("/other/meta");
});

jest.mock("@scow/config/build/install", () => ({
  getInstallConfig: (path: string) => ({
    basePath: path.includes("root") ? "/" : "/scow",
    portal: { enabled: true, basePath: "/" },
    mis: { enabled: true, basePath: "/mis" },
  }),
}));

it("serves metadata with fastify", async () => {
  const server = createMetaServer("install.yaml");

  const response = await server.inject({ method: "GET", url: "/scow/meta" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    basePath: "/scow",
    version: "1.11.1",
    components: {
      portal: "/scow",
      mis: "/scow/mis",
    },
  });
});

it("serves metadata with root base path using fastify route", async () => {
  const server = createMetaServer("root-install.yaml");

  const response = await server.inject({ method: "GET", url: "/meta" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    basePath: "/",
    version: "1.11.1",
    components: {
      portal: "/",
      mis: "/mis",
    },
  });
});

it("serves scowctl page with fastify", async () => {
  const server = createMetaServer("install.yaml");

  const response = await server.inject({ method: "GET", url: "/scow/meta/scowctl" });

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toContain("text/html");
  expect(response.body).toContain("/scow/meta/scowctl/install.sh");
  expect(response.body).toContain("/scow/meta/scowctl/install.ps1");
});

it("embeds request host in scowctl install script", async () => {
  const server = createMetaServer("install.yaml");

  const response = await server.inject({
    method: "GET",
    url: "/scow/meta/scowctl/install.sh",
    headers: {
      host: "scow.example.com",
      "x-forwarded-proto": "https",
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toContain("https://scow.example.com/scow/meta/scowctl/bin/scowctl-x64");
  expect(response.body).not.toContain("BASE_URL=");
});

it("serves scowctl binary content", async () => {
  const binDir = mkdtempSync(join(tmpdir(), "scowctl-bin-"));
  writeFileSync(join(binDir, "scowctl-x64"), "binary-content");

  const oldBinDir = process.env.SCOWCTL_BIN_DIR;
  process.env.SCOWCTL_BIN_DIR = binDir;

  let createServerWithBinDir: typeof createMetaServer;
  jest.isolateModules(() => {
    createServerWithBinDir = require("src/server").createMetaServer;
  });

  if (oldBinDir === undefined) {
    delete process.env.SCOWCTL_BIN_DIR;
  } else {
    process.env.SCOWCTL_BIN_DIR = oldBinDir;
  }

  const server = createServerWithBinDir!("install.yaml");
  const response = await server.inject({ method: "GET", url: "/scow/meta/scowctl/bin/scowctl-x64" });

  expect(response.statusCode).toBe(200);
  expect(response.body).toBe("binary-content");
});

it("returns not found for unsupported methods", async () => {
  const server = createMetaServer("install.yaml");

  const response = await server.inject({ method: "POST", url: "/scow/meta" });

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ message: "Not Found" });
});
