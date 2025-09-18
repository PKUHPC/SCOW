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

  syncAccountUser: Type.Object({
    maxSyncDurationMinutes:  (Type.Number({
      description: "单次同步最长处理时间，单位分钟，如不配置默认为5分钟。此配置会作为周期性账户用户同步"
      + "的固定最长处理时间，会作为手动同步的初始默认最长处理时间，仅在手动同步时支持修改。",
      default: 5,
    })),
    syncHistoryDayPeriod: (Type.Number({
      description: "同步账户用户历史结果数据查询时间周期，单位天，如不配置默认为7天",
      default: 7,
    })),
  }, { default: {
    maxSyncDurationMinutes: 5,
    syncHistoryDayPeriod: 7,
  }, description: "同步账户用户数据功能相关设置" }),

  jobChargeType: Type.String({ description: "对作业计费时，计费费用的付款类型", default: "作业费用" }),
  changeJobPriceType: Type.String({ description: "修改作业费用时所使用的付款/充值类型", default: "作业费用更改" }),
  quantumJobChargeType: Type.String({ description: "对量子作业计费时，计费费用的付款类型，请和量子云的taskChargeType保持一致",
    default: "量子作业费用" }),

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
      clickable: Type.Optional(Type.Boolean({ description: "一级导航是否可点击" })),
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
      dashboardUid: Type.Optional(Type.String({ description: "默认展示的 grafana 面板 id, 优先级低于dashboards" })),
      dashboards: Type.Optional(Type.Array(Type.Object({
        uid: Type.String({ description: "配置 grafana tab 面板 id" }),
        label: Type.String({ description: "配置 grafana tab 面板标签" }),
      }))),
    })),
    alarmLogs: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "是否启用告警日志功能", default: false }),
    })),
  }, { description: "集群监控相关功能配置" })),

  uiExtension: Type.Optional(UiExtensionConfigSchema),

  allowUserChangeJobTimeLimit: Type.Boolean({
    description: "普通用户和账户管理员是否可以修改作业时限",
    default: true,
  }),

  jobChargeDecimalPrecision: Type.Number({
    description: "计费精度小数位，默认2位小数，可以配置为0~4",
    default: 2,
  }),
  jobMinCharge : Type.Number({
    description: "当设置了大于0的单价时，单个作业最小扣费金额，默认为0.01，建议与计费精度一致，如果计费单价为0，此金额不生效",
    default: 0.01,
  }),

  bill: Type.Optional(Type.Object({
    enabled: Type.Boolean({
      description: "是否生成账单",
      default: true,
    }),
    monthlyCron: Type.Optional(Type.String({
      description: "执行生成月账单周期任务的cron表达式。每个账户的月账单在每个月只会生成一次，每次执行生成月账单任务的时候，已经生成账单的账户不会再次生成账单。"
      + "如填写0 1 1~2 * *，则在每个月的1、2号凌晨1点会执行，在2号执行的时候，1号已经生成账单的账户将不会被再次生成账单。",
      default: "0 1 1~2 * *" })),
    yearlyCron: Type.Optional(Type.String({
      description: "执行生成年账单周期的cron表达式。每个账户每年只会生成一次。如填写0 1 1~2 1 *，将在每年1月的1、2号凌晨1点执行，在2号执行的时候，1号已经生成账单的账户将不会被再次生成账单。",
      default: "0 1 1~2 1 *" })),

    customTerms: Type.Optional(Type.Array(
      Type.String(), {
        description: "用户自定生成指定周期的账单。可以填写年份，如2023，则系统在下次生成账单时会生成对应年的账单；可以填写{年份}{两位月份}，如202407，系统将会生成对应月的账单" },
    )),

    otherChargeTypeText: Type.String({ description: "预定义的未标明类型的消费在账单中展示的名称", default: "其它" }),


  }, { description: "账单功能配置" })),

  deleteUser: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否启用从SCOW中删除用户", default: false }),
    nameMarker: Type.String({ description: "用户名删除标识", default: "(已删除)" }),
  })),

  deleteAccount: Type.Optional(Type.Object({
    enabled: Type.Boolean({ description: "是否启用从SCOW中删除账户", default: false }),
  })),

  nodeMigration: Type.Optional(
    Type.Object({
      enabled: Type.Boolean({ description: "是否启用节点迁移功能", default: false }),
      migratableClusterGroups: Type.Optional(Type.Array(Type.Object({
        group: Type.Array(Type.String(), { description: "可以相互迁移的集群组, 如果enabled为true必须填写" }),
      }))),
    }),
  ),

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

  if (config.jobChargeDecimalPrecision && config.jobMinCharge &&
    (1 / Math.pow(10, config.jobChargeDecimalPrecision) > config.jobMinCharge)) {
    throw new Error("The config jobMinCharge needs to match the config jobChargeDecimalPrecision");
  }

  if (![0,1,2,3,4].includes(config.jobChargeDecimalPrecision)) {
    throw new Error("The config jobChargeDecimalPrecision must be one of the values 0, 1, 2, 3 or 4");
  }

  if (config.bill?.enabled) {
    config.bill.customTerms?.forEach(isValidTerm);
  }

  return config;

};

function isValidTerm(term: string) {
  const yearOnlyRegex = /^\d{4}$/; // 匹配 YYYY 格式
  const yearMonthRegex = /^\d{6}$/; // 匹配 YYYYMM 格式

  if (yearOnlyRegex.test(term)) {
    const year = parseInt(term, 10);
    const currentYear = new Date().getFullYear();
    if (!(year < currentYear)) {
      throw new Error(`Bill config customTerm ${term} must be before this year`);
    }
    return;
  }

  if (yearMonthRegex.test(term)) {
    const year = parseInt(term.substring(0, 4), 10);
    const month = parseInt(term.substring(4, 6), 10);
    const now = new Date();
    const termDate = new Date(year, month);

    if (!(termDate < now)) {
      throw new Error(`Bill config customTerm ${term} must be before this month`);
    }
    return;
  }

  throw new Error("Bill config customTerm is required 2023、2024 or 202407 array");
}
