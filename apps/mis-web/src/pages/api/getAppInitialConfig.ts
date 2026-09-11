import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { ClusterConfigSchema, SimpleClusterSchema } from "@scow/config/build/cluster";
import { createI18nStringSchema } from "@scow/config/build/i18n";
import { getPublicStorageConfig, PublicStorageConfigSchema } from "@scow/config/build/storage";
import { getDarkModeCookieValue } from "@scow/lib-web/build/layouts/darkMode";
import { getHostname } from "@scow/lib-web/build/utils/getHostname";
import { formatActivatedClusters } from "@scow/lib-web/build/utils/misCommon/clustersActivation";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { Static, Type } from "@sinclair/typebox";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { validateToken } from "src/auth/token";
import { UserState } from "src/models/User";
import { getClustersRuntimeInfo } from "src/pages/api/admin/getClustersRuntimeInfo";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { User } from "src/stores/UserStore";
import { getPublicConfigClusters } from "src/utils/cluster";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

const ClusterNameI18nSchema = createI18nStringSchema({
  description: "集群名称，支持国际化",
});
const PasswordPatternMessageSchema = createI18nStringSchema({
  description: "密码格式错误提示，支持国际化",
});

export const GetAppInitialConfigSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      userInfo: Type.Optional(Type.Unsafe<User>()),

      primaryColor: Type.Object({
        defaultColor: Type.String(),
        darkModeColor: Type.Optional(Type.String()),
      }),

      footerText: Type.Optional(Type.String()),

      initialLanguageId: Type.String(),

      systemLanguageConfig: Type.Object({
        defaultLanguage: Type.String(),
        isUsingI18n: Type.Boolean(),
        autoDetectWhenUserNotSet: Type.Boolean(),
        enabledLanguages: Type.Array(Type.String()),
      }),

      darkModeCookieValue: Type.Optional(
        Type.Object({
          dark: Type.Boolean(),
          mode: Type.Union([Type.Literal("system"), Type.Literal("dark"), Type.Literal("light")]),
        }),
      ),

      clusterConfigs: Type.Record(Type.String(), ClusterConfigSchema),
      publicStorageConfigs: PublicStorageConfigSchema,

      initialActivatedClusters: Type.Record(
        Type.String(),
        Type.Object({
          id: Type.String(),
          name: ClusterNameI18nSchema,
        }),
      ),

      initialSimpleClustersInfo: Type.Record(Type.String(), SimpleClusterSchema),
      titleTag: Type.Optional(Type.String()),

      enableChangePassword: Type.Boolean(),
      passwordPattern: Type.Optional(Type.String()),
      passwordPatternMessage: Type.Optional(PasswordPatternMessageSchema),
    }),
  },
});

export type AppInitialConfig = Static<(typeof GetAppInitialConfigSchema)["responses"]["200"]>;

export default route(GetAppInitialConfigSchema, async (req) => {
  const extra: AppInitialConfig = {
    userInfo: undefined,
    footerText: undefined,
    primaryColor: { defaultColor: "#94070A" },
    darkModeCookieValue: getDarkModeCookieValue(req),
    initialLanguageId: "",
    systemLanguageConfig: publicConfig.SYSTEM_LANGUAGE_CONFIG,
    clusterConfigs: {},
    publicStorageConfigs: { storages: [] },
    initialActivatedClusters: {},
    initialSimpleClustersInfo: {},
    titleTag: "",
    enableChangePassword: Boolean(publicConfig.ENABLE_CHANGE_PASSWORD),
    passwordPattern: publicConfig.PASSWORD_PATTERN,
    passwordPatternMessage: publicConfig.RUNTIME_I18N_CONFIG_TEXTS.passwordPatternMessage,
  };

  const token = USE_MOCK ? "123" : getTokenFromCookie({ req });

  if (token) {
    const result = await validateToken(token);

    if (result) {
      extra.userInfo = {
        ...result,
        token,
        state: UserState.NORMAL,
      };
    }
  }

  const clustersRuntimeInfo = await getClustersRuntimeInfo();
  const clusters = await getClusterConfigFiles();

  if (Object.keys(clusters).length > 0) {
    extra.clusterConfigs = clusters;
  }

  // storage.yaml 缺失时不影响系统初始化，页面侧回退为直接展示 storageId。
  try {
    extra.publicStorageConfigs = getPublicStorageConfig();
  } catch {
    extra.publicStorageConfigs = { storages: [] };
  }

  const simpleClustersInfo: Record<string, SimpleClusterSchema> = {};

  Object.keys(clusters).forEach((key) => {
    simpleClustersInfo[key] = {
      clusterId: key,
      displayName: clusters[key].displayName,
      priority: clusters[key].priority,
    };
  });
  extra.initialSimpleClustersInfo = simpleClustersInfo;

  const publicConfigClusters =
    extra.clusterConfigs && Object.keys(extra.clusterConfigs).length > 0
      ? getPublicConfigClusters(extra.clusterConfigs)
      : (getPublicConfigClusters(extra.initialSimpleClustersInfo) ?? {});

  const activatedClusters = formatActivatedClusters({
    clustersRuntimeInfo: clustersRuntimeInfo,
    misConfigClusters: publicConfigClusters,
  });

  extra.initialActivatedClusters = activatedClusters.misActivatedClusters ?? {};

  const hostname = getHostname(req);

  const defaultColor =
    (hostname && runtimeConfig.UI_CONFIG?.primaryColor?.hostnameMap?.[hostname]) ??
    runtimeConfig.UI_CONFIG?.primaryColor?.defaultColor ??
    runtimeConfig.DEFAULT_PRIMARY_COLOR;

  const darkModeColor =
    (hostname && runtimeConfig.UI_CONFIG?.primaryColor?.hostnameMap?.[hostname]) ??
    runtimeConfig.UI_CONFIG?.primaryColor?.darkModeColor ??
    defaultColor;

  extra.primaryColor = { defaultColor, darkModeColor };

  extra.footerText =
    (hostname && runtimeConfig.UI_CONFIG?.footer?.hostnameMap?.[hostname]) ??
    (hostname && runtimeConfig.UI_CONFIG?.footer?.hostnameTextMap?.[hostname]) ??
    runtimeConfig.UI_CONFIG?.footer?.defaultText;

  extra.initialLanguageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  extra.titleTag = runtimeConfig.UI_CONFIG?.titleTag;

  return { 200: extra };
});
