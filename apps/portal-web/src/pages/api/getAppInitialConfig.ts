import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { ClusterConfigSchema, getSortedClusterIds } from "@scow/config/build/cluster";
import { createI18nStringSchema } from "@scow/config/build/i18n";
import { getDarkModeCookieValue } from "@scow/lib-web/build/layouts/darkMode";
import { libGetClustersRuntimeInfo } from "@scow/lib-web/build/server/clustersActivation";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { getHostname } from "@scow/lib-web/build/utils/getHostname";
import { formatActivatedClusters } from "@scow/lib-web/build/utils/misCommon/clustersActivation";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { Static, Type } from "@sinclair/typebox";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { validateToken } from "src/auth/token";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getUserAssociatedClusterIds } from "src/server/userAssociatedClusterIds";
import { getPublicConfigClusters } from "src/utils/cluster";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const UserSchema = Type.Object({
  identityId: Type.String(),
  name: Type.Optional(Type.String()),
  token: Type.String(),
  isAdmin: Type.Boolean(), // 是否为管理员(租户或平台管理员)
});

const ClusterNameI18nSchema = createI18nStringSchema({
  description: "集群名称，支持国际化",
});
const NodeNameI18nSchema = createI18nStringSchema({
  description: "节点名称，支持国际化",
});

export const GetAppInitialConfigSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      userInfo: Type.Optional(UserSchema),
      primaryColor: Type.Object({
        defaultColor: Type.String(),
        darkModeColor: Type.Optional(Type.String()),
      }),
      footerText: Type.Optional(Type.String()),
      loginNodes: Type.Record(Type.String(), Type.Array(Type.Object({
        name: NodeNameI18nSchema,
        address: Type.String(),
      }))), // { clusterId: LoginNode[] }
      darkModeCookieValue: Type.Optional(Type.Object({ dark: Type.Boolean(), mode: Type.Union([
        Type.Literal("system"), Type.Literal("dark"), Type.Literal("light"),
      ]) })),

      initialLanguage: Type.String(),
      clusterConfigs: Type.Record(Type.String(), ClusterConfigSchema),

      initialCurrentClusters: Type.Optional(Type.Array(Type.Object({
        id: Type.String(), name: ClusterNameI18nSchema }))),

      initialPortalRuntimeDesktopEnabled: Type.Boolean(),

      userAssociatedClusterIds: Type.Optional(Type.Array(Type.String())),

      titleTag: Type.Optional(Type.String()),
    }),
  },
});

export type AppInitialConfig = Static<typeof GetAppInitialConfigSchema["responses"]["200"]>;

export default route(GetAppInitialConfigSchema, async (req) => {

  const extra: AppInitialConfig = {
    userInfo: undefined,
    footerText: undefined,
    primaryColor: { defaultColor:"#94070A" },
    darkModeCookieValue: getDarkModeCookieValue(req),
    loginNodes: {},
    initialLanguage: "",
    clusterConfigs: {},
    initialCurrentClusters: [],
    // 通过SSR获取门户系统配置文件中是否可用桌面功能
    // enabled: Type.Boolean({ description: "是否启动登录节点上的桌面功能", default: true }),
    initialPortalRuntimeDesktopEnabled: runtimeConfig.PORTAL_CONFIG.loginDesktop.enabled,
    userAssociatedClusterIds: undefined,
    titleTag: "",
  };

  const token = USE_MOCK ? "123" : getTokenFromCookie({ req });

  if (token) {
    const userInfo = await validateToken(token);

    if (userInfo) {
      const userInfo2 = await libWebGetUserInfo(
        userInfo.identityId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);

      if (userInfo2) {

        const isTenantAdmin = userInfo2.tenantRoles?.includes(0) ?? false;
        const isPlatformAdmin = userInfo2.platformRoles?.includes(0) ?? false;

        const isAdmin = isTenantAdmin || isPlatformAdmin;

        extra.userInfo = {
          ...userInfo,
          token: token,
          isAdmin,
        };

        if (publicConfig.MIS_DEPLOYED && runtimeConfig.SCOW_RESOURCE_CONFIG?.enabled) {
          const userAssociatedClusterIds = await getUserAssociatedClusterIds(
            userInfo2.affiliations.map((a) => a.accountName),
            userInfo2.tenantName,
            runtimeConfig.SCOW_RESOURCE_CONFIG,
          );

          extra.userAssociatedClusterIds = userAssociatedClusterIds;

        }

        const clusters = await getClusterConfigFiles();

        if (Object.keys(clusters).length > 0) {
          extra.clusterConfigs = clusters;

          const publicConfigClusters = Object.values(getPublicConfigClusters(clusters));

          const runtimeClusters = await libGetClustersRuntimeInfo(
            publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);

          const initialActivatedClusters = formatActivatedClusters({
            clustersRuntimeInfo: runtimeClusters,
            configClusters: publicConfigClusters,
            misDeployed: publicConfig.MIS_DEPLOYED,
          });

          // 如果用户关联账户的已授权集群存在，则系统初始集群为在线集群与已授权集群的交集
          const initialUserAssociatedClusters = extra.userAssociatedClusterIds
            ? initialActivatedClusters.activatedClusters?.filter((c) => extra.userAssociatedClusterIds?.includes(c.id))
            : initialActivatedClusters.activatedClusters;

          extra.initialCurrentClusters = initialUserAssociatedClusters ?? [];

          const clusterSortedIdList = getSortedClusterIds(clusters);

          extra.loginNodes = clusterSortedIdList.reduce((acc, cluster) => {
            acc[cluster] = clusters[cluster].loginNodes?.map((loginNode) => ({
              ...loginNode,
              name: loginNode.name,
            }));
            return acc;
          }, {});
        }
      }
    }
  }

  const hostname = getHostname(req);

  const defaultColor = (hostname && runtimeConfig.UI_CONFIG?.primaryColor?.hostnameMap?.[hostname])
      ?? runtimeConfig.UI_CONFIG?.primaryColor?.defaultColor ?? runtimeConfig.DEFAULT_PRIMARY_COLOR;

  const darkModeColor = (hostname && runtimeConfig.UI_CONFIG?.primaryColor?.hostnameMap?.[hostname])
    ?? runtimeConfig.UI_CONFIG?.primaryColor?.darkModeColor ?? defaultColor;

  extra.primaryColor = { defaultColor,darkModeColor };

  extra.footerText = (hostname && runtimeConfig.UI_CONFIG?.footer?.hostnameMap?.[hostname])
      ?? (hostname && runtimeConfig.UI_CONFIG?.footer?.hostnameTextMap?.[hostname])
      ?? runtimeConfig.UI_CONFIG?.footer?.defaultText;

  extra.titleTag = runtimeConfig.UI_CONFIG?.titleTag;
  // 从Cookies或header中获取语言id
  extra.initialLanguage = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  return { 200: extra };
});
