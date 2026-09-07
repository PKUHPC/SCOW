process.env.AUTH_TYPE = "ssh";
process.env.SSH_PRIVATE_KEY_PATH = "/tmp/scow-auth-ssh-test/missing-id_rsa";
process.env.SSH_PUBLIC_KEY_PATH = "/tmp/scow-auth-ssh-test/missing-id_rsa.pub";

import { buildApp } from "src/app";

it("fails to initialize SSH authentication when key files are missing", async () => {
  // Fastify instances are thenables; awaiting buildApp() would implicitly call ready().
  const server = buildApp();

  await expect(server.ready()).rejects.toThrow(/ENOENT/);
  await server.close();
});
