import { FastifyReply, FastifyRequest } from "fastify";
import { validateCallbackHostname } from "src/auth/callback";
import { validateCaptcha } from "src/auth/captcha";

export const validateLoginParams = async (
  captchaToken: string,
  captchaCode: string,
  callbackUrl: string,
  req: FastifyRequest,
  rep: FastifyReply,
) => {
  await validateCallbackHostname(callbackUrl, req);

  if (!(await validateCaptcha(captchaCode, captchaToken, callbackUrl, req, rep))) {
    return false;
  }

  return true;
};
