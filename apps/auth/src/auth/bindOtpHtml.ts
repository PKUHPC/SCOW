import { getCommonConfig, getSystemLanguageConfig } from "@scow/config/build/common";
import { DEFAULT_PRIMARY_COLOR } from "@scow/config/build/ui";
import { getCurrentLanguageId } from "@scow/lib-server";
import { FastifyReply, FastifyRequest } from "fastify";
import { join } from "path";
import { config, FAVICON_URL } from "src/config/env";
import { uiConfig } from "src/config/ui";
import { AuthTextsType, loadLanguageDefinitions } from "src/i18n";
import { getHostname } from "src/utils/getHostname";

export async function renderBindOtpHtml(
  err: boolean,
  req: FastifyRequest,
  rep: FastifyReply,
  callbackUrl: string,
  otp?: {
    sendEmailUI?: boolean;
    sendSucceeded?: boolean;
    tokenNotFound?: boolean;
    emailAddress?: string;
    qrcode?: string;
    otpSessionToken?: string;
    timeDiffNotEnough?: number;
    bindLimitMinutes?: number;
  },
) {
  const hostname = getHostname(req);

  // 获取当前语言ID及对应的绑定OTP页面文本
  const languageId = getCurrentLanguageId(req.raw, getSystemLanguageConfig(getCommonConfig().systemLanguage));
  const authTexts: AuthTextsType = await loadLanguageDefinitions(languageId);

  return rep.status(err ? 401 : 200).view("/otp/bindOtp.liquid", {
    authTexts: authTexts,
    cssUrl: join(config.BASE_PATH, config.AUTH_BASE_PATH, "/public/assets/tailwind.min.css"),
    faviconUrl: join(config.BASE_PATH, FAVICON_URL),
    backgroundColor:
      (hostname && uiConfig.primaryColor?.hostnameMap?.[hostname]) ??
      uiConfig.primaryColor?.defaultColor ??
      DEFAULT_PRIMARY_COLOR,
    err,
    callbackUrl,
    footerText:
      (hostname && uiConfig?.footer?.hostnameMap?.[hostname]) ??
      (hostname && uiConfig?.footer?.hostnameTextMap?.[hostname]) ??
      uiConfig?.footer?.defaultText ??
      "",
    ...otp,
    otpBasePath: join(config.BASE_PATH, config.AUTH_BASE_PATH, "/public/otp"),
  });
}
