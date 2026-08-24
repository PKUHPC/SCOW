"use client";

import { getExtensionRouteQuery } from "@scow/lib-web/build/extensions/common";
import { fromNavItemProps, rewriteNavigationsRoute, toNavItemProps } from "@scow/lib-web/build/extensions/navigations";
import { callExtensionRoute } from "@scow/lib-web/build/extensions/routes";
import {
  ExtensionManifestWithUrl,
  fetchManifestsWithErrorHandling,
  UiExtensionStoreData,
} from "@scow/lib-web/build/extensions/UiExtensionStore";
import { calcActiveKeys } from "@scow/lib-web/build/layouts/base/common";
import { Footer } from "@scow/lib-web/build/layouts/base/Footer";
import { SideNav } from "@scow/lib-web/build/layouts/base/SideNav";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { arrayContainsElement, joinWithUrl } from "@scow/utils";
import { Grid, Layout } from "antd";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { join } from "path";
import React, { PropsWithChildren, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { usePublicConfig } from "src/app/(auth)/context";
import { useUiConfig } from "src/app/uiContext";
import { useI18n } from "src/i18n";
import { Header } from "src/layouts/base/header";
import { useDarkMode } from "src/layouts/darkMode";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

const { useBreakpoint } = Grid;

const Root = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const ContentPart = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
`;

const Content = styled(Layout.Content)<{ $isDashboard: boolean; $isFullBleedPage: boolean }>`
  margin: ${(props) => (props.$isFullBleedPage ? "0" : props.$isDashboard ? "8px 8px 0px" : "8px")};
  padding: ${(props) => (props.$isFullBleedPage ? "0" : "16px")};
  flex: 1;
  display: ${(props) => (props.$isDashboard ? "flex" : "block")};
  flex-direction: column;
  background: ${({ theme }) => theme.token.colorBgLayout};
  max-height: calc(100vh - 78px);
  overflow-y: auto;
  .ant-table-wrapper .ant-table {
    scrollbar-color: auto !important;
  }
`;

const StyledLayout = styled(Layout)`
  position: relative;
`;

type Props = PropsWithChildren<{
  routes?: NavItemProps[];
  user?: ClientUserInfo | undefined;
  headerRightContent?: React.ReactNode;
  footerText?: string | undefined;
  versionTag?: string | undefined;
}>;

export const BaseLayout: React.FC<PropsWithChildren<Props>> = ({
  routes = [],
  children,
  user = undefined,
  headerRightContent,
}) => {
  const router = useRouter();
  const [uiExtensionData, setUiExtensionData] = useState<UiExtensionStoreData | undefined>(undefined);

  const pathname = usePathname() ?? "";
  const isFullBleedPage = pathname.startsWith("/jobs/createApp/");

  const { dark } = useDarkMode();

  const { md } = useBreakpoint();

  const useLogoutMutation = trpc.auth.logout.useMutation();

  const languageId = useI18n().currentLanguage.id;

  const publicConfig = usePublicConfig()?.publicConfig;
  const uiExtensionConfig = publicConfig?.UI_EXTENSION;
  const authPath = join(publicConfig?.BASE_PATH ?? "", "api/auth");

  const { hostname, uiConfig } = useUiConfig();
  const footerConfig = uiConfig.config?.footer;
  const footerText = (hostname && footerConfig?.hostnameMap?.[hostname]) ?? footerConfig?.defaultText;

  useLayoutEffect(() => {
    if (pathname === "/dashboard") {
      // 强制清除所有可能的滚动偏移
      window.scrollTo(0, 0);
      // 适应现代浏览器
      if (document.documentElement) document.documentElement.scrollTop = 0;
      // Safari或特定布局
      if (document.body) document.body.scrollTop = 0;
    }
  }, [pathname]);

  const extensions = useMemo(
    () =>
      (Array.isArray(uiExtensionData) ? uiExtensionData : uiExtensionData ? [uiExtensionData] : []).filter((x) => x),
    [uiExtensionData],
  );

  const routeQuery = useMemo(
    () => getExtensionRouteQuery(dark, languageId, user?.token),
    [dark, languageId, user?.token],
  );

  useEffect(() => {
    fetchUiExtension();
  }, [uiExtensionConfig]);

  // fetchUiExtension 只负责获取扩展数据，不负责处理路由
  const fetchUiExtension = useCallback(async () => {
    if (!uiExtensionConfig) {
      setUiExtensionData(undefined);
      return;
    }

    let result: UiExtensionStoreData;
    if (Array.isArray(uiExtensionConfig)) {
      const promises = uiExtensionConfig.map((config) => fetchManifestsWithErrorHandling(config.url, config.name));
      const results = await Promise.all(promises);
      result = results.filter(Boolean) as (ExtensionManifestWithUrl & { name: string })[];
    } else {
      const resp = await fetchManifestsWithErrorHandling(uiExtensionConfig.url);
      result = resp;
    }

    setUiExtensionData(result);
  }, [uiExtensionConfig]);

  const { data: finalRoutesData } = useAsync({
    promiseFn: useCallback(async () => {
      if (extensions.length === 0) {
        return routes;
      }

      let newRoutes = routes;

      for (const extension of extensions) {
        if (!extension.manifests.ai?.rewriteNavigations) {
          continue;
        }

        const resp = await callExtensionRoute(
          rewriteNavigationsRoute("ai"),
          routeQuery,
          {
            navs: fromNavItemProps(newRoutes),
          },
          extension.url,
        ).catch((e) => {
          console.warn(`Failed to call rewriteNavigations of extension ${extension.name ?? extension.url}. Error: `, e);
          return { 200: { navs: newRoutes } };
        });

        if (resp[200]) {
          newRoutes = toNavItemProps(newRoutes, resp[200].navs, extension.name);
        }
      }

      return newRoutes;
    }, [routeQuery, extensions, routes]),
  });

  const finalRoutes = finalRoutesData ?? routes;

  const activeKeys = useMemo(
    () => (finalRoutes ? [...calcActiveKeys(finalRoutes, pathname)] : []),
    [finalRoutes, pathname],
  );

  const firstLevelRoute = finalRoutes.find((x) => activeKeys.includes(x.path));

  const sidebarRoutes = md ? firstLevelRoute?.children : finalRoutes;

  const hasSidebar = arrayContainsElement(sidebarRoutes);

  const primaryRoutes = (finalRoutes ?? routes).map((route) => {
    const { children, ...rest } = route;
    return rest;
  });

  return (
    <Root>
      <Header
        extensions={extensions}
        routeQuery={routeQuery}
        pathname={pathname}
        routes={primaryRoutes}
        user={user}
        logout={() => {
          useLogoutMutation.mutateAsync().then(() => {
            window.location.href = authPath;
          });
        }}
        userLinks={[]}
        languageId={languageId}
        operationLogUrl={publicConfig?.MIS_URL ? joinWithUrl(publicConfig.MIS_URL, "/operationLog") : undefined}
        right={headerRightContent}
      />
      <StyledLayout>
        {hasSidebar ? (
          <SideNav activeKeys={activeKeys} pathname={pathname} routes={sidebarRoutes} appRouter={router} />
        ) : undefined}
        <ContentPart>
          <Content $isDashboard={pathname === "/dashboard"} $isFullBleedPage={isFullBleedPage}>
            {children}
            {pathname === "/dashboard" ? (
              <Footer text={footerText} versionTag={usePublicConfig()?.publicConfig?.VERSION_TAG} />
            ) : (
              ""
            )}
          </Content>
        </ContentPart>
      </StyledLayout>
    </Root>
  );
};
