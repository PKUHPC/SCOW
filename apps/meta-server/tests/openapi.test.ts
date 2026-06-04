import { InstallConfigSchema } from "@scow/config/build/install";
import { createMergedOpenApiDocument, getOpenApiSources } from "src/openapi";

it("creates openapi sources from enabled components", () => {
  const sources = getOpenApiSources({
    basePath: "/scow",
    portal: { enabled: true, basePath: "/" },
    mis: { enabled: true, basePath: "/mis" },
    ai: { enabled: false, basePath: "/ai" },
    resource: { basePath: "/resource" },
  } as InstallConfigSchema);

  expect(sources).toEqual([
    {
      name: "portal",
      systemBasePath: "/scow",
      publicBasePath: "/scow",
      internalUrl: "http://portal-web:3000/scow/api/openapi.json",
    },
    {
      name: "mis",
      systemBasePath: "/scow",
      publicBasePath: "/scow/mis",
      internalUrl: "http://mis-web:3000/scow/mis/api/openapi.json",
    },
    {
      name: "resource",
      systemBasePath: "/scow",
      publicBasePath: "/scow/resource",
      internalUrl: "http://resource:3000/scow/resource/api/openapi.json",
    },
  ]);
});

it("merges openapi specs and prefixes component refs", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      openapi: "3.1.0",
      paths: {
        "/api/users": {
          get: {
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: "object",
            properties: {
              profile: { $ref: "#/components/schemas/Profile" },
            },
          },
          Profile: {
            type: "object",
          },
        },
      },
    }),
  } as Response);

  const doc = await createMergedOpenApiDocument([
    {
      name: "portal",
      systemBasePath: "/scow",
      publicBasePath: "/scow",
      internalUrl: "http://portal-web:3000/scow/api/openapi.json",
    },
  ]);

  expect(doc.paths["/scow/api/users"].get.responses[200].content["application/json"].schema).toEqual({
    $ref: "#/components/schemas/portal_User",
  });
  expect(doc.components.schemas.portal_User.properties.profile).toEqual({
    $ref: "#/components/schemas/portal_Profile",
  });
  expect(doc["x-scow-sources"]).toEqual([
    { name: "portal", url: "http://portal-web:3000/scow/api/openapi.json", ok: true },
  ]);
  expect(doc.info.description).toContain("[scowctl](/scow/meta/scowctl)");
  expect(doc.info.description).not.toContain("/scow/meta/scowctl/bin/scowctl-x64");
  expect(doc.info.description).not.toContain("/scow/meta/scowctl/bin/scowctl-arm64");
  expect(doc.info.description).not.toContain("/scow/meta/scowctl/bin/scowctl-macos-arm64");
  expect(doc.info.description).not.toContain("/scow/meta/scowctl/bin/scowctl-windows-x64.exe");

  fetchMock.mockRestore();
});

it("uses source openapi server pathname when available", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      openapi: "3.1.0",
      servers: [{ url: "http://ai:3000/scow/ai/api" }],
      paths: {
        "/auth/userInfo": { get: { responses: { 200: { description: "OK" } } } },
      },
    }),
  } as Response);

  const doc = await createMergedOpenApiDocument([
    {
      name: "ai",
      systemBasePath: "/scow",
      publicBasePath: "/scow/ai",
      internalUrl: "http://ai:3000/scow/ai/api/openapi.json",
    },
  ]);

  expect(doc.paths["/scow/ai/api/auth/userInfo"]).toBeDefined();

  fetchMock.mockRestore();
});
