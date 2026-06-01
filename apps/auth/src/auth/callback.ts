import { createError } from "@fastify/error";
import { parseArray } from "@scow/lib-config";
import { FastifyReply, FastifyRequest } from "fastify";
import { authConfig } from "src/config/auth";
import { config } from "src/config/env";

const allowedCallbackHostnames = new Set<string>([
  "localhost",
  "127.0.0.1",
  ...authConfig.allowedCallbackHostnames,
  ...parseArray(config.EXTRA_ALLOWED_CALLBACK_HOSTNAMES),
]);

export const CallbackHostnameNotAllowedError = createError(
  "CALLBACK_DOMAIN_NOT_ALLOWED",
  "Provided callback url is not in the allowed callback hostname list.",
  400,
);
export const CallbackUrlNotValidError = createError(
  "CALLBACK_URL_INVALID",
  "Provided callback url is not a valid url.",
  400,
);

export async function validateCallbackHostname(callbackUrl: string, req: FastifyRequest) {
  // req.hostname includes port, which we don't want
  const incomingHostname = req.hostname.split(":")[0];

  try {
    const callbackHostname = new URL(callbackUrl).hostname;

    if (callbackHostname === incomingHostname) {
      return;
    }

    if (!allowedCallbackHostnames.has(callbackHostname)) {
      throw new CallbackHostnameNotAllowedError();
    }
  } catch (e) {
    if (e instanceof TypeError && (e as any).code === "ERR_INVALID_URL") {
      throw new CallbackUrlNotValidError();
    } else {
      throw e;
    }
  }
}

export async function redirectToWeb(callbackUrl: string, token: string, rep: FastifyReply) {
  const searchParams = new URLSearchParams({ token, fromAuth: "true" });

  await rep.redirect(302, `${callbackUrl}?${searchParams.toString()}`);
}
