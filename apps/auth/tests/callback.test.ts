process.env.AUTH_TYPE = "ssh";

import { FastifyInstance } from "fastify";
import { buildApp } from "src/app";
import { CallbackHostnameNotAllowedError } from "src/auth/callback";
import { saveCaptchaText } from "src/auth/captcha";
import {
  allowedCallbackUrl,
  createFormData,
  notAllowedCallbackUrl,
  testUserPassword,
  testUserUsername,
} from "tests/utils";

const username = testUserUsername;
const password = testUserPassword;
const captchaToken = "captchaToken";
const captchaCode = "captchaCode";

let server: FastifyInstance;

beforeEach(async () => {
  server = await buildApp();

  await server.ready();
});

afterEach(async () => {
  await server.close();
});

it("allows to login page with allowed callback url", async () => {
  const resp = await server.inject({
    method: "GET",
    path: "/public/auth",
    query: { callbackUrl: allowedCallbackUrl },
  });

  expect(resp.statusCode).toBe(200);
});

// TODO this test did not exit one second after the test run has completed.

it("doesn't allow to login page with not allowed callback url", async () => {
  const resp = await server.inject({
    method: "GET",
    path: "/public/auth",
    query: { callbackUrl: notAllowedCallbackUrl },
  });

  expect(resp.statusCode).toBe(400);
  expect(resp.json().code).toBe(new CallbackHostnameNotAllowedError().code);
});

it("redirects to allowed origin after login", async () => {
  const { payload, headers } = createFormData({
    username: username,
    password: password,
    callbackUrl: allowedCallbackUrl,
    token: captchaToken,
    code: captchaCode,
  });

  await saveCaptchaText(server, captchaCode, captchaToken);
  const resp = await server.inject({
    method: "POST",
    path: "/public/auth",
    payload,
    headers,
  });

  expect(resp.statusCode).toBe(302);
  expect(resp.headers.location).toStartWith(allowedCallbackUrl + "?token=");
});

it("doesn't redirect to not allowed origin after login", async () => {
  const { payload, headers } = createFormData({
    username: username,
    password: password,
    callbackUrl: notAllowedCallbackUrl,
    token: captchaToken,
    code: captchaCode,
  });

  await saveCaptchaText(server, captchaCode, captchaToken);
  const resp = await server.inject({
    method: "POST",
    path: "/public/auth",
    payload,
    headers,
  });

  expect(resp.statusCode).toBe(400);
  expect(resp.json().code).toBe(new CallbackHostnameNotAllowedError().code);
});
