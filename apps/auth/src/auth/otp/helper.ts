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

import * as crypto from "crypto";
import { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import ldapjs from "ldapjs";
import { Liquid } from "liquidjs";
import * as nodemailer from "nodemailer";
import { TransportOptions } from "nodemailer";
import { join } from "path";
import * as speakeasy from "speakeasy";
import { renderBindOtpHtml } from "src/auth/bindOtpHtml";
import { extractAttr, searchOne, takeOne } from "src/auth/ldap/helpers";
import { serveLoginHtml } from "src/auth/loginHtml";
import { authConfig, LdapConfigSchema, OtpLdapSchema, OtpStatusOptions } from "src/config/auth";
import { config } from "src/config/env";

import { decryptData, encryptData, generateIvAndKey } from "./aesUtils";

const separator = "#";
export const AES_ENCRYPTION_IV_KEY_REDIS_KEY = "auth:otp:ivkey";

interface OtpSessionInfo {
  dn: string,
  sendEmailTimestamp?: number,
}
interface IvAndKey {
  iv: Buffer,
  key: Buffer,
}

function encodeIvKeyToBase64(ivAndKey: IvAndKey) {
  return ivAndKey.iv.toString("base64") + separator + ivAndKey.key.toString("base64");
}
function decodeIvKeyFromBase64(data: string): IvAndKey {
  const encryIv = data.split(separator)[0];
  const encryKey = data.split(separator)[1];
  const iv = Buffer.from(encryIv, "base64");
  const key = Buffer.from(encryKey, "base64");
  return {
    iv,
    key,
  };
}

export async function getIvAndKey(f: FastifyInstance) {
  const data = await f.redis.get(AES_ENCRYPTION_IV_KEY_REDIS_KEY);
  if (!data) {
    return undefined;
  }
  return decodeIvKeyFromBase64(data);
}

export async function getOtpSession(key: string, f: FastifyInstance): Promise<OtpSessionInfo | undefined> {
  const redisUserInfoJSON = await f.redis.get(key);
  if (!redisUserInfoJSON) {
    return;
  }
  return JSON.parse(redisUserInfoJSON);
}

export async function saveOtpSession(
  key: string, data: OtpSessionInfo, expirationTimeSeconds: number, f: FastifyInstance,
) {
  await f.redis.set(key, JSON.stringify(data), "EX", expirationTimeSeconds);
}

export async function renderLiquidFile(fileName: string, data: Record<string, string>): Promise<string> {
  const engine = new Liquid({
    root: "views/otp",
    extname: ".liquid",
  });
  return await engine.renderFile(fileName, data);
}

export async function storeOtpSessionAndGoSendEmailUI(
  f: FastifyInstance,
  req: FastifyRequest,
  res: FastifyReply,
  ldapConfig: LdapConfigSchema,
  logger: FastifyBaseLogger,
  client: ldapjs.Client,
  callbackUrl: string,
  bindLimitMinutes: number,
  userInfo: {
    dn: string,
  },
) {
  const otpSessionToken = crypto.randomUUID();
  await saveOtpSession(otpSessionToken, userInfo, bindLimitMinutes * 60, f);
  const mailAttributeName = ldapConfig.attrs.mail;
  if (!mailAttributeName) {
    throw new Error("ldapConfig.attrs.mail can not be undefined");
  }
  const emailAddressInfo =
    await searchOneAttributeValueFromLdap(userInfo.dn, logger, mailAttributeName, client);

  let ivAndKey = await getIvAndKey(f);
  if (!ivAndKey) {
    ivAndKey = generateIvAndKey();
    const encryptedIvKey = encodeIvKeyToBase64(ivAndKey);
    await f.redis.set(AES_ENCRYPTION_IV_KEY_REDIS_KEY, encryptedIvKey);
  }
  const encryptOtpSessionToken = encryptData(ivAndKey, otpSessionToken);
  await renderBindOtpHtml(false, req, res, callbackUrl,
    { bindLimitMinutes: bindLimitMinutes, otpSessionToken: encryptOtpSessionToken,
      emailAddress: emailAddressInfo?.value });
  return;
}

export async function sendEmailAuthLink(
  f: FastifyInstance,
  otpSessionToken: string,
  req: FastifyRequest,
  res: FastifyReply,
  logger: FastifyBaseLogger,
  emailAddress: string,
  callbackUrl: string,
  otpLdap: OtpLdapSchema,
) {
  const ivAndKey = await getIvAndKey(f);
  if (!ivAndKey) {
    // redis中没有ivKey信息，返回信息过期UI
    await renderBindOtpHtml(false, req, res, callbackUrl,
      { bindLimitMinutes: otpLdap.bindLimitMinutes, tokenNotFound: true });
    return;
  }
  const decryptedOtpSessionToken = decryptData(ivAndKey, otpSessionToken);
  const otpSession = await getOtpSession(decryptedOtpSessionToken, f);
  if (!otpSession) {
    // 信息过期
    await renderBindOtpHtml(false, req, res, callbackUrl,
      { bindLimitMinutes: otpLdap.bindLimitMinutes, tokenNotFound: true });
    return;
  }

  const currentTimestamp = getAbsoluteUTCTimestamp();
  if (otpSession.sendEmailTimestamp !== undefined) {
    // 获取邮件链接需至少间隔authConfig.otp.ldap.mail.sendEmailFrequencyLimitInSeconds
    const timeDiff = Math.floor(currentTimestamp / 1000 - otpSession.sendEmailTimestamp);
    if (timeDiff < otpLdap.authenticationMethod.mail.sendEmailFrequencyLimitInSeconds) {
      await renderBindOtpHtml(
        false, req, res, callbackUrl,
        { bindLimitMinutes: otpLdap.bindLimitMinutes, emailAddress: emailAddress,
          timeDiffNotEnough: otpLdap.authenticationMethod.mail.sendEmailFrequencyLimitInSeconds
           - timeDiff, otpSessionToken });
      return;
    }
  }
  otpSession.sendEmailTimestamp = Math.floor(currentTimestamp / 1000);

  const ttl = await f.redis.ttl(decryptedOtpSessionToken);

  await saveOtpSession(decryptedOtpSessionToken, otpSession, ttl, f);
  const transporter = nodemailer.createTransport({
    host: otpLdap.authenticationMethod.mail.mailTransportInfo.host,
    port: otpLdap.authenticationMethod.mail.mailTransportInfo.port,
    secure: otpLdap.authenticationMethod.mail.mailTransportInfo.secure,
    auth: {
      user: otpLdap.authenticationMethod.mail.mailTransportInfo.user,
      pass: otpLdap.authenticationMethod.mail.mailTransportInfo.password,
    },
  } as TransportOptions);
  const scowHostUrl = new URL(otpLdap.scowHost);
  const href = String(Object.assign(new URL("http://example.com"), {
    protocol: scowHostUrl.protocol,
    host: scowHostUrl.host,
    pathname: join(config.BASE_PATH, config.AUTH_BASE_PATH, "/public/otp/email/validation"),
    search: `token=${otpSessionToken}&callbackUrl=${callbackUrl}`,
  }));
  const mailOptions = {
    from: otpLdap.authenticationMethod.mail.from,
    to: emailAddress,
    subject: otpLdap.authenticationMethod.mail.subject,
    html: await renderLiquidFile("email", {
      href: href,
      title: otpLdap.authenticationMethod.mail.title,
      contentText: otpLdap.authenticationMethod.mail.contentText,
      labelText: otpLdap.authenticationMethod.mail.labelText,
    }),
  };

  const emailSent = await transporter.sendMail(mailOptions).then(() => true).catch((e) => {
    logger.error(e, "error in sending OTP binding email");
    return false;
  });

  await renderBindOtpHtml(
    false, req, res, callbackUrl,
    { bindLimitMinutes: otpLdap.bindLimitMinutes, sendSucceeded: emailSent,
      timeDiffNotEnough: otpLdap.authenticationMethod.mail.sendEmailFrequencyLimitInSeconds,
      emailAddress: emailAddress, otpSessionToken: otpSessionToken });
}

export function getAbsoluteUTCTimestamp() {
  const currentTime = new Date();
  return Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), currentTime.getUTCDate(),
    currentTime.getUTCHours(), currentTime.getUTCMinutes(), currentTime.getUTCSeconds(),
    currentTime.getUTCMilliseconds());
}

export async function searchOneAttributeValueFromLdap(
  dn: string, logger: FastifyBaseLogger, attributeName: string,
  client: ldapjs.Client) {
  return await searchOne(logger, client, dn,
    {
      scope: "base",
      filter: "(objectClass=*)",
      attributes: ["*"],
    }, (e) => {
      const value = takeOne(extractAttr(e, attributeName));
      return { value };
    },
  );
}

interface UserInfo {
  userId: string,
  dn: string,
}

export async function remoteValidateOtpCode(userId: string, logger: FastifyBaseLogger, inputCode?: string) {
  if (!authConfig.otp?.enabled) {
    return true;
  }
  const otpRemote = authConfig.otp.remote!;
  return await fetch(otpRemote.validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      otpCode: inputCode,
      userId: userId,
    }),
  }).then(async (response) => {
    const result: { result: boolean } = await response.json();
    return result.result;
  }).catch((e) => {
    logger.error(e, "error in verifying otp code in remote");
    return false;
  });
}

export async function validateOtpCode(
  userInfo: UserInfo,
  inputCode: string | undefined,
  callbackUrl: string,
  req: FastifyRequest,
  res: FastifyReply,
  logger: FastifyBaseLogger,
  client: ldapjs.Client,
) {
  if (!authConfig.otp?.enabled) {
    return true;
  }
  if (!inputCode) {
    await serveLoginHtml({ err: false }, callbackUrl, req, res, undefined, true);
    return false;
  }

  const time = getAbsoluteUTCTimestamp();
  if (authConfig.otp.type === OtpStatusOptions.remote) {
    if (await remoteValidateOtpCode(userInfo.userId, logger, inputCode)) {
      return true;
    } else {
      await serveLoginHtml({ err: false }, callbackUrl, req, res, undefined, true);
      return false;
    }

  }

  // 如果是otp.type是ldap
  const otpLdap = authConfig.otp.ldap!;
  const secretInfo = await searchOneAttributeValueFromLdap(
    userInfo.dn, logger, otpLdap.secretAttributeName, client);
  if (!secretInfo?.value) {
    logger.error("fail to find otp secret from ldap");
    await serveLoginHtml({ err: false }, callbackUrl, req, res, undefined, true);
    return false;
  }
  const result = speakeasy.totp.verify({
    token: inputCode,
    time: time / 1000,
    encoding: "base32",
    secret: secretInfo.value,
    digits: 6,
    step: 30,
    algorithm: "sha1",
  });
  if (result) {
    return true;
  } else {
    // 如果验证失败，验证是否是上一个otp码
    const isPreOtpCode = speakeasy.totp.verify({
      token: inputCode,
      time: time / 1000 - 30,
      encoding: "base32",
      secret: secretInfo.value,
      digits: 6,
      step: 30,
      algorithm: "sha1",
    });
    if (isPreOtpCode) {
      return true;
    } else {
      await serveLoginHtml({ err: false }, callbackUrl, req, res, undefined, true);
      return false;
    }
  }
}

