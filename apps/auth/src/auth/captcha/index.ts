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

import { Static, Type } from "@sinclair/typebox";
import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { serveLoginHtml } from "src/auth/loginHtml";
import { authConfig } from "src/config/auth";
import svgCaptcha from "svg-captcha";

export const CAPTCHA_TOKEN_PREFIX = "captcha:";
export interface CaptchaInfo {
  code: string;
  token: string;
}
/**
 * @param f the FastifyInstance
 * @param token If a token is passed in,
 * the generated text will be stored in Redis with this token as the key.
 * If no token is passed in, a random token will be generated as the key to store the generated text.
 */
export async function saveCaptchaText(
  f: FastifyInstance, text: string, token?: string, validSeconds: number = 120): Promise<string> {
  token = token ?? randomUUID();
  await f.redis.set(CAPTCHA_TOKEN_PREFIX + token, text, "EX", validSeconds);
  return token;
}

/**
 * @param f the FastifyInstance
 * @param token If a token is passed in,
 * the generated text will be stored in Redis with this token as the key.
 * If no token is passed in, a random token will be generated as the key to store the generated text.
 */
export async function createCaptcha(f: FastifyInstance, token?: string): Promise<CaptchaInfo> {

  const options = {
    size: 4,
    ignorechars: "0oIi1l",
    noise: 3,
    color: true,
    background: "#cc9966",
  };

  const captcha = svgCaptcha.create(options);

  const data = captcha.data;
  const text = captcha.text;
  token = await saveCaptchaText(f, text, token);
  return { code: data, token };

}

export async function validateCaptcha(
  code: string, token: string, callbackUrl: string, req: FastifyRequest, res: FastifyReply,
) {

  if (!authConfig.captcha.enabled) { return true; }

  const redisCode = await req.server.redis.getdel(CAPTCHA_TOKEN_PREFIX + token);
  if (code.toLowerCase() === redisCode?.toLowerCase()) {
    return true;
  }

  await serveLoginHtml({ err: true }, callbackUrl, req, res, true);
  return false;
}

const bodySchema = Type.Object({
  token: Type.String(),
});
export function registerCaptchaRoute(f: FastifyInstance) {
  f.post<{ Body: Static<typeof bodySchema> }>(
    "/public/refreshCaptcha",
    {
      schema:{
        body: bodySchema,
      },
    },
    async (req, res) => {
      const { token } = req.body;
      const data = (await createCaptcha(f, token)).code;
      await res.type("image/svg+xml").send(data);
    });
}
