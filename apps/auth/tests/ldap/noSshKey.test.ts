process.env.AUTH_TYPE = "ldap";
process.env.SSH_PRIVATE_KEY_PATH = "/tmp/scow-auth-ldap-test/missing-id_rsa";
process.env.SSH_PUBLIC_KEY_PATH = "/tmp/scow-auth-ldap-test/missing-id_rsa.pub";

import { FastifyInstance } from "fastify";
import { buildApp } from "src/app";

let server: FastifyInstance;

beforeEach(async () => {
  server = await buildApp();
  await server.ready();
});

afterEach(async () => {
  await server.close();
});

it("starts LDAP authentication without SSH key files", () => {
  expect(server).toBeDefined();
});
