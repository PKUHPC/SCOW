import { joinWithUrl } from "@scow/utils";
import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import ldapjs from "ldapjs";
import * as QRCode from "qrcode";
import * as speakeasy from "speakeasy";
import { renderBindOtpHtml } from "src/auth/bindOtpHtml";
import { findUser, useLdap } from "src/auth/ldap/helpers";
import { authConfig, LdapConfigSchema, OtpConfigSchema, OtpLdapSchema, OtpStatusOptions } from "src/config/auth";
import { config } from "src/config/env";
import { promisify } from "util";

import { decryptData } from "./aesUtils";
import {
  getIvAndKey,
  getOtpSession,
  renderLiquidFile,
  sendEmailAuthLink,
  storeOtpSessionAndGoSendEmailUI,
} from "./helper";

/**
 *  登录界面->绑定OTP界面
 *  绑定OTP界面->登录界面重定向
 * */
export function bindRedirectLoinUIAndBindUIRoute(f: FastifyInstance, otp: OtpConfigSchema) {
  const QuerystringSchema = Type.Object({
    action: Type.Enum({ bindOtp: "bindOtp", backToLoginUI: "backToLoginUI" }),
    callbackUrl: Type.String(),
  });

  f.get<{
    Querystring: Static<typeof QuerystringSchema>;
  }>(
    "/public/otp/bind",
    {
      schema: {
        querystring: QuerystringSchema,
      },
    },
    async (req, res) => {
      const { action, callbackUrl } = req.query;
      if (otp.type === OtpStatusOptions.ldap) {
        if (action === "bindOtp") {
          await renderBindOtpHtml(false, req, res, callbackUrl);
          return;
        }
        if (action === "backToLoginUI") {
          const loginUrl = joinWithUrl(
            otp.ldap!.scowHost,
            config.BASE_PATH,
            config.AUTH_BASE_PATH,
            `/public/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          );
          return res.redirect(loginUrl);
        }
      }
      if (otp.type === OtpStatusOptions.remote) {
        if (action === "bindOtp") {
          if (!otp.remote!.redirectUrl) {
            throw new Error("otp.remote!.redirectUrl is undefined");
          }
          return res.redirect(otp.remote!.redirectUrl);
        }
      }
      return;
    },
  );
}

//  验证用户名密码->发送邮件页面
export function bindValidateUserNameAndPasswordRoute(f: FastifyInstance, ldapConfig: LdapConfigSchema) {
  const bodySchema = Type.Object({
    username: Type.String(),
    password: Type.String(),
    action: Type.String(),
    callbackUrl: Type.String(),
  });
  f.post<{ Body: Static<typeof bodySchema> }>(
    "/public/otp/bind",
    {
      schema: { body: bodySchema },
    },
    async (req, res) => {
      const { username, password, callbackUrl } = req.body;

      const logger = req.log.child({ plugin: "ldap" });
      await useLdap(
        logger,
        ldapConfig,
      )(async (client) => {
        const user = await findUser(logger, ldapConfig, client, username).catch(async () => {
          await renderBindOtpHtml(true, req, res, callbackUrl);
        });

        if (!user) {
          logger.info("Didn't find user with %s=%s", ldapConfig.attrs.uid, username);
          await renderBindOtpHtml(true, req, res, callbackUrl);
          return;
        }
        logger.info("Trying binding as %s with credentials", user.dn);
        await useLdap(logger, ldapConfig, { dn: user.dn, password })(async () => {
          logger.info("Binding as %s successful. User info %o", user.dn, user);

          await storeOtpSessionAndGoSendEmailUI(
            f,
            req,
            res,
            ldapConfig,
            logger,
            client,
            callbackUrl,
            authConfig.otp!.ldap!.bindLimitMinutes,
            { dn: user.dn },
          );
        }).catch(async (err) => {
          logger.info("error occurs. Err: %o", err);
          await renderBindOtpHtml(true, req, res, callbackUrl);
        });
      });
    },
  );
}

// 点击获取绑定链接
export function bindClickRequestBindingLinkRoute(f: FastifyInstance) {
  const bodySchema = Type.Object({
    otpSessionToken: Type.String(),
    emailAddress: Type.String(),
    callbackUrl: Type.String(),
  });
  f.post<{ Body: Static<typeof bodySchema> }>(
    "/public/otp/sendEmail",
    {
      schema: {
        body: bodySchema,
      },
    },
    async (req, res) => {
      const { otpSessionToken, emailAddress, callbackUrl } = req.body;
      const logger = req.log;

      await sendEmailAuthLink(f, otpSessionToken, req, res, logger, emailAddress, callbackUrl, authConfig.otp!.ldap!);
    },
  );
}
// 点击邮箱中的绑定链接
export function bindClickAuthLinkInEmailRoute(
  f: FastifyInstance,
  ldapConfig: LdapConfigSchema,
  otpLdap: OtpLdapSchema,
) {
  const QuerystringSchema = Type.Object({
    token: Type.String(),
    callbackUrl: Type.String(),
  });

  // 用于处理用户在邮箱中点击确认链接
  f.get<{
    Querystring: Static<typeof QuerystringSchema>;
  }>(
    "/public/otp/email/validation",
    {
      schema: {
        querystring: QuerystringSchema,
      },
    },
    async (req, res) => {
      const { token, callbackUrl } = req.query;
      const logger = req.log;
      const ivAndKey = await getIvAndKey(f);
      if (!ivAndKey) {
        // 返回用户信息过期
        await renderBindOtpHtml(false, req, res, callbackUrl, {
          bindLimitMinutes: otpLdap.bindLimitMinutes,
          tokenNotFound: true,
        });
        return;
      }
      const decryptedOtpSessionToken = decryptData(ivAndKey, token);
      const otpSession = await getOtpSession(decryptedOtpSessionToken, f);
      if (!otpSession) {
        // 信息过期
        await renderBindOtpHtml(false, req, res, callbackUrl, {
          bindLimitMinutes: otpLdap.bindLimitMinutes,
          tokenNotFound: true,
        });
        return;
      }
      // 将secret信息存入ldap;
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      await useLdap(
        logger,
        ldapConfig,
      )(async (client) => {
        logger.info("Binding as %s successful.", otpSession.dn);
        const modify = promisify(client.modify.bind(client));
        await modify(
          otpSession.dn,
          new ldapjs.Change({
            operation: "replace",
            modification: {
              [otpLdap.secretAttributeName]: secret,
            },
          }),
        );
      });
      const uid = /uid=([^,]+)/i.exec(otpSession.dn)?.[1];
      const url = speakeasy.otpauthURL({
        secret: secret,
        label: `${uid}@${otpLdap.label}`,
        issuer: uid!,
        digits: 6,
        period: 30,
        algorithm: "sha1",
        encoding: "base32",
      });
      const urlImg = await QRCode.toDataURL(url);
      await f.redis.del(decryptedOtpSessionToken);
      const renderedFile = await renderLiquidFile("qrcode", {
        contentText: otpLdap.qrcodeDescription,
        urlImg,
        callbackUrl: callbackUrl,
      });
      await res.header("Content-Type", "text/html; charset=utf-8").send(renderedFile);
    },
  );
}
