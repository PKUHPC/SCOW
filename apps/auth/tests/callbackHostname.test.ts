import { FastifyRequest } from "fastify";

afterEach(() => {
  jest.dontMock("src/config/auth");
  jest.dontMock("src/config/env");
  jest.resetModules();
});

it.each(["localhost", "127.0.0.1"])("always allows %s callback hostname", async (hostname) => {
  jest.doMock("src/config/auth", () => ({
    authConfig: { allowedCallbackHostnames: [] },
  }));
  jest.doMock("src/config/env", () => ({
    config: { EXTRA_ALLOWED_CALLBACK_HOSTNAMES: "" },
  }));

  const { validateCallbackHostname } = await import("src/auth/callback");

  await expect(
    validateCallbackHostname(`http://${hostname}:1234/callback`, {
      hostname: "scow.example.com",
    } as FastifyRequest),
  ).resolves.toBeUndefined();
});
