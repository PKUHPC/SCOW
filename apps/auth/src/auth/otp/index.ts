import { FastifyInstance } from "fastify";
import { authConfig, LdapConfigSchema, OtpStatusOptions } from "src/config/auth";

import {
  bindClickAuthLinkInEmailRoute,
  bindClickRequestBindingLinkRoute,
  bindRedirectLoinUIAndBindUIRoute,
  bindValidateUserNameAndPasswordRoute,
} from "./routeHandles";

export function registerOtpBindPostHandler(f: FastifyInstance, ldapConfig: LdapConfigSchema) {
  if (!authConfig.otp?.enabled) {
    return;
  }

  /**
   *  登录界面->绑定OTP界面
   *  绑定OTP界面->登录界面重定向
   * */
  bindRedirectLoinUIAndBindUIRoute(f, authConfig.otp);

  if (authConfig.otp.type === OtpStatusOptions.ldap) {
    // 绑定路由，路由处理验证账户密码
    bindValidateUserNameAndPasswordRoute(f, ldapConfig);
    // 绑定路由，路由处理发邮件
    bindClickRequestBindingLinkRoute(f);
    // 绑定路由，路由处理绑定获取二维码
    bindClickAuthLinkInEmailRoute(f, ldapConfig, authConfig.otp.ldap!);
  }
}
