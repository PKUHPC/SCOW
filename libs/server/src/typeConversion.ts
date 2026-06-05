import { ClusterConfigSchema, LoginNodeConfigSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import {
  ClusterConfigSchemaProto,
  ClusterConfigSchemaProto_LoginNodesProtoType,
} from "@scow/protos/build/common/config";
import { I18nObject_I18n, I18nStringProtoType } from "@scow/protos/build/common/i18n";
import { underscoreNamingToCamelCase } from "@scow/utils/build/i18n";

export function isStringArray(arr: any[]): arr is string[] {
  return arr.every((item) => typeof item === "string");
}

export function isObjectArray(arr: any[]): arr is object[] {
  return arr.every((item) => typeof item === "object" && item !== null);
}

export const getI18nSeverTypeFormat = (i18nConfig: I18nStringType): I18nStringProtoType | undefined => {
  if (!i18nConfig) return undefined;

  if (typeof i18nConfig === "string") {
    return { value: { $case: "directString", directString: i18nConfig } };
  } else {
    return {
      value: {
        $case: "i18nObject",
        i18nObject: {
          i18n: Object.entries(i18nConfig.i18n).reduce(
            (acc, [key, value]) => ({ ...acc, [underscoreNamingToCamelCase(key)]: value }),
            {} as I18nObject_I18n,
          ),
        },
      },
    };
  }
};

export const getLoginNodesSeverTypeFormat = (
  loginNodes: string[] | LoginNodeConfigSchema[],
): ClusterConfigSchemaProto_LoginNodesProtoType | undefined => {
  if (!loginNodes) return undefined;

  if (loginNodes instanceof Array && loginNodes.every((node) => typeof node === "string")) {
    return { value: { $case: "loginNodeAddresses", loginNodeAddresses: { loginNodeAddressesValue: loginNodes } } };
  } else {
    return {
      value: {
        $case: "loginNodeConfigs",
        loginNodeConfigs: {
          loginNodeConfigsValue: loginNodes.map((node) => ({
            name: getI18nSeverTypeFormat(node.name)!,
            address: node.address,
            scowd: node.scowd,
          })),
        },
      },
    };
  }
};

export const convertClusterConfigsToServerProtoType = (
  clusterConfigs: Record<string, ClusterConfigSchema>,
): ClusterConfigSchemaProto[] => {
  const clusterConfigsProto: ClusterConfigSchemaProto[] = [];

  for (const key in clusterConfigs) {
    const item = clusterConfigs[key];

    const protoItem: ClusterConfigSchemaProto = {
      clusterId: key,
      displayName: getI18nSeverTypeFormat(item.displayName)!,
      adapterUrl: item.adapterUrl,
      priority: item.priority,
      scowd: item.scowd
        ? {
            enabled: item.scowd?.enabled ?? false,
          }
        : undefined,
      proxyGateway: item.proxyGateway
        ? {
            url: item.proxyGateway.url || "",
            autoSetupNginx: item.proxyGateway.autoSetupNginx,
          }
        : undefined,
      loginNodes: getLoginNodesSeverTypeFormat(item.loginNodes)!,
      loginDesktop: item.loginDesktop
        ? {
            enabled: item.loginDesktop.enabled,
            wms: item.loginDesktop.wms.map((wm) => ({ name: wm.name, wm: wm.wm })),
            maxDesktops: item.loginDesktop.maxDesktops,
            desktopsDir: item.loginDesktop.desktopsDir,
            shadowDesk: item.loginDesktop.shadowDesk
              ? {
                  enabled: !!item.loginDesktop?.shadowDesk?.enabled,
                  proxyServer: item.loginDesktop.shadowDesk?.proxyServer ?? "",
                  wms: item.loginDesktop.shadowDesk?.wms ?? ["xfce"],
                  appId: item.loginDesktop.shadowDesk?.appId ?? "",
                  appSecret: item.loginDesktop.shadowDesk?.appSecret ?? "",
                }
              : undefined,
          }
        : undefined,
      turboVncPath: item.turboVNCPath ?? undefined,
      crossClusterFileTransfer: item.crossClusterFileTransfer
        ? {
            enabled: item.crossClusterFileTransfer.enabled,
            transferNode: item.crossClusterFileTransfer?.transferNode ?? undefined,
          }
        : undefined,
      hpc: {
        enabled: item.hpc.enabled,
        job: item.hpc.job ? { maxRunningTimeHours: item.hpc.job.maxRunningTimeHours } : undefined,
        app: item.hpc.app ? { maxRunningTimeHours: item.hpc.app.maxRunningTimeHours } : undefined,
      },
      ai: {
        enabled: item.ai.enabled,
      },
      storage: item.storage,
      description: item.description ? getI18nSeverTypeFormat(item.description) : undefined,
    };

    clusterConfigsProto.push(protoItem);
  }

  return clusterConfigsProto;
};

// 合并多个I18n字符，用于I18n类型后端传递
export function mergeI18nStrings(i18nStrings: I18nStringType[]): I18nStringType {
  if (i18nStrings.length === 0) {
    return "";
  }

  if (i18nStrings.length === 1) {
    return i18nStrings[0];
  }

  // 提取所有语言的文本
  const defaultTexts: string[] = [];
  const enTexts: string[] = [];
  const zhCnTexts: string[] = [];

  i18nStrings.forEach((str) => {
    if (typeof str === "string") {
      // 如果是普通字符串，所有语言都用这个值
      defaultTexts.push(str);
      enTexts.push(str);
      zhCnTexts.push(str);
    } else {
      // 如果是 i18n 对象，分别提取
      defaultTexts.push(str.i18n.default);
      enTexts.push(str.i18n.en ?? str.i18n.default);
      zhCnTexts.push(str.i18n.zh_cn ?? str.i18n.default);
    }
  });

  // 合并为一个 i18n 对象
  return {
    i18n: {
      default: zhCnTexts.join("，"),
      en: enTexts.join(", "),
      zh_cn: zhCnTexts.join("，"),
    },
  };
}
