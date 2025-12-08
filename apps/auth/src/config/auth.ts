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

import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";

import { AuthType } from "./AuthType";

export enum NewUserGroupStrategy {
  "newGroupPerUser" = "newGroupPerUser",
  "oneGroupForAllUsers" = "oneGroupForAllUsers",
}

export enum OtpStatusOptions {
  "ldap" = "ldap",
  "remote" = "remote",
}

export enum ScowLogoType {
  "dark" = "dark",
  "light" = "light",
}

// 创建配置文件中显示文字项的配置类型
export const createI18nStringSchema = ({ description, defaultValue }: {
  description: string, defaultValue?: string
}) => {
  return Type.Union([
    Type.String(),
    Type.Object({
      i18n: Type.Object({
        default: Type.String({ description: "国际化类型默认值" }),
        en: Type.Optional(Type.String({ description: "国际化类型英文值" })),
        zh_cn: Type.Optional(Type.String({ description: "国际化类型简体中文值" })),
      }),
    }),
  ], { description, default: defaultValue });
};

export const LdapConfigSchema = Type.Object({
  url: Type.String({ description: "LDAP地址" }),
  searchBase: Type.String({ description: "从哪个节点搜索登录用户对应的LDAP节点" }),
  bindDN: Type.String({ description: "操作LDAP时以什么用户操作，默认为空字符串", default: "" }),
  bindPassword: Type.String({ description: "操作LDAP的用户的密码，默认为空字符串", default: "" }),
  userFilter: Type.String({ description: "LDAP用户筛选器" }),
  addUser: Type.Optional(Type.Object({
    enabledForScow: Type.Boolean({ description: "是否允许从SCOW中创建用户", default: true }),
    userBase: Type.String({ description: "LDAP增加用户节点时，把用户增加到哪个节点下" }),
    homeDir: Type.String({
      description: "LDAP增加用户时，用户的homeDirectory值。使用{{ userId }}代替新用户的用户名",
      default: "/nfs/{{ userId }}",
    }),

    userIdDnKey: Type.Optional(Type.String({
      description: `
      LDAP增加用户时，新用户节点的DN中，第一个路径的属性的key。
      新用户节点的DN为{userIdDnKey}={用户ID},{userBase}
      如果不填写，则使用ldap.attrs.uid的值
      `,
    })),

    groupStrategy: Type.Enum(NewUserGroupStrategy, { description: `
      如何确定新用户的组。
      ${NewUserGroupStrategy.newGroupPerUser}: 给每个用户创建一个新的组
      ${NewUserGroupStrategy.oneGroupForAllUsers}: 将所有用户加入某个已有的组
    ` }),

    newGroupPerUser: Type.Optional(Type.Object({
      groupBase: Type.String({ description: "LDAP增加用户对应的组时，把组节点增加到哪个节点下" }),
      groupIdDnKey: Type.Optional(Type.String({ description: `
      新的组节点的DN中，第一个路径的属性的key。
      新的组节点的DN为{groupIdDnKey}={用户ID},{groupBase}
      如果不填写，则使用ldap.attrs.uid的值
      ` })),
      extraProps: Type.Optional(Type.Record(
        Type.String(),
        Type.Union([Type.Null(), Type.String(), Type.Array(Type.String())],
          {
            description: `
          组的节点应该额外拥有的属性值。
          值可以为字符串、字符串列表或者null。如果为null，则不会添加此值。
          符串可以使用 {{ 用户节点的属性key }}来使用用户节点的属性值
        `,
          }))),
    }, { description: "如果groupStrategy采用newGroupPerUser，填写新的组节点的配置信息" })),

    oneGroupForAllUsers: Type.Optional(Type.Object({
      gidNumber: Type.Integer({ description: "新用户将会加入的组的gidNumber属性值" }),
    }, { description: "如果groupStrategy采用oneGroupForAllUsers，填写原有组的信息" })),

    addUserToLdapGroup: Type.Optional(
      Type.String({ description: "LDAP增加用户时，应该把用户增加到哪个LDAP Group下。如果不填，创建用户后不会增加用户到Group" }),
    ),

    uidStart: Type.Integer({
      description: `
      LDAP创建用户时，uid从多少开始。生成的用户的uid等于此值加上用户账户中创建的用户ID。
      如果采用newGroupPerUser的用户组策略，创建的组的gid和uid和此相同。`,
      default: 66000,
    }),

    extraProps: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Union([Type.Null(), Type.String(), Type.Array(Type.String())]),
        { description: `
          LDAP增加用户时，用户项除了id、name和mail，还应该添加哪些属性。
          属性值可以为字符串、字符串列表或者null。
          如果属性值为null，那么将不会添加这个属性。如果值为null的属性名为默认添加的值，则那个默认添加的值也不会被添加。
          如果这里出现了uid, name或email同名的属性，这里的值将替代用户输入的值。
          属性值支持使用 {{ 用户节点的属性key }} 格式来使用已有用户节点的属性值
          例如：{ sn: "{{ cn }}" }，那么添加时将会增加一个sn属性，其值为cn的属性，即为用户输入的姓名
        `,
        })),
  }, { description: "添加用户的配置" })),
  deleteUser: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否允许从SCOW中删除用户", default: false }),
  }, { description: "删除用户的配置" })),
  attrs: Type.Object({
    uid: Type.String({ description: "LDAP中对应用户的id的属性名。" }),
    name: Type.Optional(Type.String({ description: `
        LDAP对应用户姓名的属性名。此字段用于
        1. 登录时显示为用户的姓名
        2. 创建用户的时候把姓名信息填入LDAP
        3. 管理系统添加用户时，验证ID和姓名是否匹配

        如果不设置此字段，那么
        1. 用户姓名为用户的ID
        2. 创建用户时姓名信息填入LDAP
        3. 管理系统添加用户时，不验证ID与姓名是否匹配
    ` })),
    mail: Type.Optional(Type.String({ description: "LDAP中对应用户的邮箱的属性名。可不填。此字段只用于在创建用户的时候把邮件信息填入LDAP。" })),
    loginShell: Type.Optional(Type.String({ description: "LDAP中对应用户在 Unix/Linux 系统上的默认shell。当前仅用于判断用户是否被禁止登录" })),
  }, { description: "属性映射" }),
  ppolicy: Type.Optional(Type.Object({
    defaultOlcPPolicyDn: Type.Optional(Type.String({ description: "密码策略条目DN，根据该 DN 加载对应的密码规则‌，默认所有用户或组使用此策略" })),
    pwdMaxFailures: Type.Optional(Type.Number({ description: "允许用户连续输入错误密码的最大次数。" })),
    pwdLockoutDurationMinutes: Type.Optional(Type.Number({ description: "用户被锁定后的持续时间（分钟），若设为 0 表示必须由管理员手动解锁‌。" })),
    pwdMustChangeAtFirstLoginOrResetByAdmin: Type.Optional(Type.Boolean({ description: "是否强制用户在首次登录或重置密码后修改密码。" })),
  })),
}, { description: "LDAP配置" });

export type LdapConfigSchema = Static<typeof LdapConfigSchema>;

export const SshConfigSchema = Type.Object({
  baseNode: Type.Optional(Type.String({ description: "SSH认证中，以哪个节点为认证用户的基础。如果不设置则为第一个集群的第一个登录节点" })),
}, { description: "SSH配置", default: {} });

export const OtpLdapSchema = Type.Object({
  bindLimitMinutes: Type.Integer({ description: "限制绑定otp要在多少分钟内完成", default: 10 }),
  scowHost: Type.String({ description: "scow的ip地址或者域名，用来组成发送邮件地址" }),
  secretAttributeName: Type.String({ description: "存储otp密钥的属性名", default: "otpSecret" }),
  qrcodeDescription: Type.String({ description: "secret二维码上方文字描述信息", default: "此二维码仅出现一次，用过即毁" }),
  label:  Type.String({ description: "otp验证软件扫描二维码之后，出现的label中，用户名和@后显示的名称", default: "SCOW" }),
  authenticationMethod: Type.Object({
    mail: Type.Object({
      sendEmailFrequencyLimitInSeconds: Type.Integer({ description: "发送邮件频率限制", default: 60 }),
      from: Type.String({ description: "发件邮箱地址" }),
      subject: Type.String({ description: "邮件主题", default: "OTP绑定链接" }),
      title: Type.String({ description: "邮件内容标题", default: "Bind OTP" }),
      contentText: Type.String({ description: "邮件内容",
        default: "Please click on the following link to bind your OTP:" }),
      labelText: Type.String({ description: "标签点击文字", default: "Bind OTP" }),
      mailTransportInfo: Type.Object({
        host: Type.String({ description: "SMTP服务器" }),
        secure: Type.Boolean({ description: "是否启用SSL/TSL加密", default: false }),
        port: Type.Integer({ description: "服务器端口" }),
        user: Type.String({ description: "SMTP身份验证用户名" }),
        password: Type.String({ description: "SMTP身份验证授权码" }),
      }),
    }, { description: "发送邮件的配置信息" }),
  }, { description: "发送绑定链接相关配置" }),
}, { description: "将otp密钥存在ldap需要配置信息" });

export const UiConfigSchema = Type.Object({
  default: Type.Object({
    backgroundImagePath: Type.String({ description: "默认背景图片", default: "./assets/background.png" }),
    backgroundFallbackColor: Type.String({ description: "默认背景颜色", default: "#8c8c8c" }),
    logo: Type.Object({
      scowLogoType: Type.Enum(ScowLogoType, { description: "scow logo 类型", default: ScowLogoType.dark }),
      customLogoPath: Type.Optional(Type.String({ description: "用户自定义 logo 图片" })),
      customLogoLink: Type.Optional(Type.String({ description: "用户自定义点击 logo 跳转链接" })),
    }, { default: {} }),
    slogan: Type.Object({
      color: Type.String({ description: "默认标语文字颜色", default: "#595959" }),
      title: createI18nStringSchema({ description: "默认标语标题", defaultValue: "" }),
      texts: Type.Array(createI18nStringSchema({ description: "默认 slogan 正文", defaultValue: "" })
        , { description: "默认 slogan 正文数组", default: []}),
    }, { default: {} }),
    footerTextColor: Type.String({ description: "默认 footer 文字颜色", default: "white" }),
    footerText: Type.Optional(createI18nStringSchema({ description: "默认 footer 文字" })),
  }),
  hostnameMap: Type.Optional(Type.Record(Type.String(), Type.Object({
    backgroundImagePath: Type.Optional(Type.String({ description: "默认背景图片" })),
    backgroundFallbackColor: Type.Optional(Type.String({ description: "默认背景颜色" })),
    logo: Type.Optional(Type.Object({
      scowLogoType: Type.Optional(Type.Enum(ScowLogoType, { description: "scow logo 类型" })),
      customLogoPath: Type.Optional(Type.String({ description: "用户自定义 logo 图片" })),
      customLogoLink: Type.Optional(Type.String({ description: "用户自定义点击 logo 跳转链接" })),
    })),
    slogan: Type.Optional(Type.Object({
      color: Type.String({ description: "默认标语文字颜色" }),
      title: createI18nStringSchema({ description: "默认标语标题", defaultValue: "" }),
      texts: Type.Array(createI18nStringSchema({ description: "默认 slogan 正文", defaultValue: "" }),
        { description: "默认 slogan 正文数组" }),
    })),
    footerTextColor: Type.Optional(Type.String({ description: "默认 footer 文字颜色" })),
    footerText: Type.Optional(createI18nStringSchema({ description: "默认 footer 文字" })),
  }))),
});

export const OtpConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否启用otp", default: false }),
  type: Type.Optional(Type.Enum(OtpStatusOptions, { description: "otp功能状态" })),
  ldap: Type.Optional(OtpLdapSchema),
  remote: Type.Optional(Type.Object({
    validateUrl: Type.String({ description: "远程验证otp码的url" }),
    redirectUrl: Type.Optional(Type.String({ description: "当用户点击绑定OTP时，302重定向的链接" })),
  }, { description: "将密钥存在远程地址时的配置信息" })),
}, { description: "otp功能配置" });

export type SshConfigSchema = Static<typeof SshConfigSchema>;
export type OtpLdapSchema = Static<typeof OtpLdapSchema>;
export type OtpConfigSchema = Static<typeof OtpConfigSchema>;
export type UiConfigSchema = Static<typeof UiConfigSchema>;

export const AuthConfigSchema = Type.Object({
  redisUrl: Type.String({ description: "存放token的redis地址", default: "redis:6379" }),
  tokenTimeoutSeconds: Type.Integer({ description: "token未使用的失效时间", default: 3600 }),
  authType: Type.Enum(AuthType, { description: "认证类型", default: "ssh" }),
  ldap: Type.Optional(LdapConfigSchema),
  ssh: Type.Optional(SshConfigSchema),
  allowedCallbackHostnames: Type.Array(Type.String({ description: "信任的回调域名" }), { default: []}),
  mockUsers: Type.Optional(Type.Record(
    Type.String(), Type.String(),
    { description: "模仿用户，如果登录的用户的ID为某个key，则改为以对应的value的用户登录。修改此配置无需重启认证系统" },
  )),
  captcha: Type.Object({
    enabled: Type.Boolean({ description: "验证码功能是否启用，默认为启用", default: true }),
  }, { default: { enabled: true } }),
  otp: Type.Optional(OtpConfigSchema),
  ui: Type.Optional(UiConfigSchema),
});

export type AuthConfigSchema = Static<typeof AuthConfigSchema>;

export const AUTH_CONFIG_FILE = "auth";

export const getAuthConfig = () => {
  const config = getConfigFromFile(AuthConfigSchema, AUTH_CONFIG_FILE, DEFAULT_CONFIG_BASE_PATH);

  // validate
  if (config.authType === AuthType.ldap) {
    if (!config.ldap) {
      throw new Error("authType is set to ldap, but ldap config is not set");
    }

    if (config.ldap.addUser) {


      if (config.ldap.addUser.groupStrategy === NewUserGroupStrategy.newGroupPerUser
    && !config.ldap.addUser.newGroupPerUser) {
        throw new Error(`
      ldap.addUser.groupStrategy is set to ${NewUserGroupStrategy.newGroupPerUser} is set to ldap,
      but ldap.addUser.groupStrategy.newGroupPerUser config is not set`,
        );
      }

      if (config.ldap.addUser.groupStrategy === NewUserGroupStrategy.oneGroupForAllUsers
    && !config.ldap.addUser.oneGroupForAllUsers) {
        throw new Error(`
      ldap.addUser.groupStrategy is set to ${NewUserGroupStrategy.oneGroupForAllUsers} is set to ldap,
      but ldap.addUser.groupStrategy.oneGroupFroAllUsers config is not set`,
        );
      }
    }
  }

  if (config.authType === AuthType.ssh && !config.ssh) {
    throw new Error("authType is set to ssh, but ssh config is not set");
  }

  if (config.otp?.enabled) {
    if (!config.otp.type) {
      throw new Error("config.otp.enabled is set to true, but config.otp.type is not to set");
    }
    if (config.otp?.type === OtpStatusOptions.ldap && !config.otp?.ldap) {
      throw new Error("otp status is set to ldap, but otp.ldap config is not set");
    }
    if (config.otp?.type === OtpStatusOptions.ldap && !config.ldap?.attrs.mail) {
      throw new Error("otp status is set to ldap, but ldap.attrs.mail is not set");
    }
    if (config.otp?.type === OtpStatusOptions.remote && !config.otp?.remote) {
      throw new Error("otp status is set to remote, but otp.remote config is not set");
    }
    if (config.authType === AuthType.ssh && config.otp?.type === OtpStatusOptions.ldap) {
      throw new Error("When authType is set to ssh, otp.type can only be set to remote");
    }
  }

  return config;
};

export const authConfig = getAuthConfig();
