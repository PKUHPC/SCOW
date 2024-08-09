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

import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";
import { createI18nStringSchema } from "src/i18n";
import { checkUiExtensionConfig, UiExtensionConfigSchema } from "src/uiExtensions";

export enum JobTableType {
  mariadb = "mariadb",
  mysql = "mysql",
}

export const MisConfigSchema = Type.Object({
  db: Type.Object({
    host: Type.String({ description: "数据库地址" }),
    port: Type.Integer({ description: "数据库端口" }),
    user: Type.String({ description: "数据库用户名" }),
    password: Type.Optional(Type.String({ description: "数据库密码" })),
    dbName: Type.String({ description: "数据库数据库名" }),
    debug: Type.Boolean({ description: "打开ORM的debug模式", default: false }),
  }),

  authUrl: Type.String({ description: "认证服务的地址。一定要加协议(http://)", default: "http://auth:5000" }),

  portalUrl: Type.Optional(Type.String({ description: "如果部署了门户系统，设置门户系统的部署URL或者pathname" })),

  aiUrl: Type.Optional(Type.String({ description: "AI系统的部署URL或者路径" })),

  predefinedChargingTypes: Type.Array(Type.String(), { description: "预定义的充值类型", default: []}),

  accountNamePattern: Type.Optional(Type.Object({
    regex: Type.String({ description: "账户名的正则规则" }),
    errorMessage: Type.Optional(createI18nStringSchema({ description: "如果账户名不符合规则显示什么" })),
  })),

  createUser: Type.Object({
    enabled: Type.Boolean({ description: "是否启用用户从SCOW中创建用户", default: true }),

    type: Type.Union([Type.Literal("builtin"), Type.Literal("external")], {
      description: "用户创建方式", default: "builtin",
    }),

    external: Type.Optional(Type.Object({
      url: Type.String({ description: "创建用户的页面" }),
    }, { description: "通过外置页面创建用户时的配置。使用此配置无需认证系统支持创建用户" })),

    userIdPattern: Type.Optional(Type.Object({
      regex: Type.String({ description: "用户ID的正则规则" }),
      errorMessage: Type.Optional(createI18nStringSchema({ description: "如果用户ID不符合规则显示什么" })),
    }, { deprecated: true, description: "请使用createUser.builtin.userIdPattern" })),

    builtin: Type.Optional(Type.Object({
      userIdPattern: Type.Optional(Type.Object({
        regex: Type.String({ description: "用户ID的正则规则" }),
        errorMessage: Type.Optional(createI18nStringSchema({ description: "如果用户ID不符合规则显示什么" })),
      }, { description: "从管理系统里创建用户时，用户ID的验证规则" })),
    }, { default: {}, description: "通过内置页面创建用户时的配置。要使用内置页面，认证系统需要支持创建用户" })),
  }, { default: {}, description: "SCOW的创建用户相关配置" }),

  addUserToAccount: Type.Object({
    accountAdmin: Type.Object({
      allowed: Type.Boolean({
        default: true,
        description: "是否允许账户管理员添加用户至账户",
      }),
      createUserIfNotExist: Type.Boolean({
        default: true,
        description: " 是否允许账户管理员添加不存在的用户时创建用户",
      }),
    }, {
      default: {},
      description: "账户管理员添加用户至账户相关配置",
    }),
  }, {
    default: {},
    description: "添加用户至账户相关配置",
  }),

  fetchJobs: Type.Object({
    startDate: Type.Optional(Type.String({ description: "从哪个时间点开始获取结束作业信息(ISO 8601)", format: "date-time" })),
    batchSize: Type.Integer({
      description: "为了防止一次性获取太多数据占用过多内存，将会限制一次获取的作业数量",
      default: 10000,
    }),

    periodicFetch: Type.Object({
      enabled: Type.Boolean({ description:"是否默认打开", default: true }),
      cron: Type.String({ description: "获取信息的周期的cron表达式", default: "* * 1 * * *" }),
    }, { default: {} }),
  }, { default: {}, description: "获取作业功能的相关配置" }),

  periodicSyncUserAccountBlockStatus: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description:"是否默认打开", default: true }),
    cron: Type.String({ description: "获取信息的周期的cron表达式", default: "0 4 * * *" }),
  }, { default: {}, description: "用户账户封锁状态同步" })),

  jobChargeType: Type.String({ description: "对作业计费时，计费费用的的付款类型", default: "作业费用" }),
  changeJobPriceType: Type.String({ description: "修改作业费用时所使用的付款/充值类型", default: "作业费用更改" }),

  jobChargeComment: Type.String({
    description: "给作业扣费时，扣费项的备注。可以使用{{ 属性名 }}使用作业信息中的属性。字段参考src/entities/JobInfo",
    default: "集群: {{ cluster }}，作业ID：{{ idJob }}",
  }),

  jobChargeMetadata: Type.Optional(Type.Object({
    savedFields: Type.Optional(Type.Array(Type.String({
      description: "需要保存的作业的字段。字段参考src/entities/JobInfo" }))),
    displayFormats: Type.Optional(createI18nStringSchema({
      description: "定义元数据显示的格式，i18n类型或string类型，利用{{ 属性名 }}使用上述savedFields中保存的属性" })),
  })),

  navLinks: Type.Optional(Type.Array(
    Type.Object({
      text: Type.String({ description: "一级导航名称" }),
      url: Type.Optional(Type.String({ description: "一级导航链接" })),
      openInNewPage: Type.Optional(Type.Boolean({ description:"一级导航是否默认在新页面打开", default: false })),
      iconPath: Type.Optional(Type.String({ description: "一级导航链接显示图标路径" })),
      allowedRoles: Type.Optional(Type.Array(Type.String(), { description: "可以看到这个链接的用户" })),
      children: Type.Optional(Type.Array(Type.Object({
        text: Type.String({ description: "二级导航名称" }),
        url: Type.String({ description: "二级导航链接" }),
        openInNewPage: Type.Optional(Type.Boolean({ description:"二级导航是否默认在新页面打开", default: false })),
        iconPath: Type.Optional(Type.String({ description: "二级导航链接显示图标路径" })),
        allowedRoles: Type.Optional(Type.Array(Type.String(), { description: "可以看到这个链接的用户" })),
      }))),
    })),
  ),

  customAmountStrategies: Type.Optional(Type.Array(
    Type.Object({
      id:  Type.String({ description: "自定义计量方式，与max-cpusAlloc-mem、max-gpu-cpusAlloc、gpu、cpusAlloc平级，会存到数据库里" }),
      name:  Type.Optional(Type.String({ description: "计量方式名，与CPU和内存分配量、GPU和CPU分配量、GPU分配量、CPU分配量平级" })),
      comment:  Type.Optional(Type.String({ description: "计量方式描述" })),
      script: Type.String({
        description: "脚本文件路径，不包含config/scripts前缀，如my-strategy.js即等于config/scripts/my-strategy.js" }),
    }),
  )),

  customChargeTypes: Type.Optional(Type.Array(
    Type.String(), { description: "用户自定义可查询的消费类型列表" },
  )),

  clusterMonitor: Type.Optional(Type.Object({
    grafanaUrl: Type.String({ description: "Grafana 地址", default: "http://127.0.0.1:4000" }),
    resourceStatus: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否开启资源状态，默认为 false", default: false }),
      proxy: Type.Boolean({ description: "是否通过代理方式嵌入 grafana，默认为 false", default: false }),
      dashboardUid: Type.String({ description: "默认展示的 grafana 面板 id", default: "shZOtO4Sk" }),
    })),
    alarmLogs: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用告警日志功能", default: false }),
    })),
  }, { description: "集群监控相关功能配置" })),

  uiExtension: Type.Optional(UiExtensionConfigSchema),

  allowUserChangeJobTimeLimit: Type.Boolean({
    description: "普通用户是否可以修改作业时限",
    default: true,
  }),

  chargePrecision: Type.Number({
    description: "计费精度小数位，默认2位小数，可以配置为0~4",
    default: 2,
  }),
  minChargeAmount : Type.Number({
    description: "当设置了大于0的单价时，单个作业最小扣费金额，默认为0.01，建议与计费精度一致，如果计费单价为0，此金额不生效",
    default: 0.01,
  }),

});

const MIS_CONFIG_NAME = "mis";

export type MisConfigSchema = Static<typeof MisConfigSchema>;

export const getMisConfig: GetConfigFn<MisConfigSchema> = (baseConfigPath, logger) => {
  const config = getConfigFromFile(MisConfigSchema, MIS_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  if (config.createUser.type === "external" && !config.createUser.external) {
    throw new Error("createUser.external is required when createUser.type is external");
  }

  if (config.createUser.type === "builtin" && !config.createUser.builtin) {
    throw new Error("createUser.builtin is required when createUser.type is builtin");
  }

  if (config.createUser.type === "builtin"
  && config.createUser.userIdPattern && !config.createUser.builtin?.userIdPattern) {
    logger?.warn("createUser.userIdPattern is deprecated, please use createUser.builtin.userIdPattern");
  }

  if (config.uiExtension) {
    checkUiExtensionConfig(config.uiExtension);
  }

  return config;

};
