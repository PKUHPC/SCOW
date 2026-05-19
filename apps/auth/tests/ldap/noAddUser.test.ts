import { authConfig } from "src/config/auth";
authConfig.ldap!.addUser = undefined;

import { FastifyInstance } from "fastify";
import { buildApp } from "src/app";
import { Capabilities } from "src/routes/capabilities";

let server: FastifyInstance;

beforeEach(async () => {
  server = await buildApp();

  await server.ready();
});

afterEach(async () => {
  await server.close();
});

it("should report no createUser capability", async () => {
  const resp = await server.inject({
    method: "GET",
    url: "/capabilities",
  });

  const body: Capabilities = await resp.json();
  expect(body.createUser).toBeFalse();
});
