"use client";

import { arrayContainsElement } from "@scow/utils";
import { Grid, Layout } from "antd";
import { useRouter } from "next/router";
import React, { PropsWithChildren, useCallback, useMemo } from "react";
import { useAsync } from "react-async";
import { getExtensionRouteQuery } from "src/extensions/common";
import { fromNavItemProps, rewriteNavigationsRoute, toNavItemProps } from "src/extensions/navigations";
import { callExtensionRoute } from "src/extensions/routes";
import { UiExtensionStoreData } from "src/extensions/UiExtensionStore";
import { calcActiveKeys } from "src/layouts/base/common";
import { Footer } from "src/layouts/base/Footer";
import { Header, HeaderNavbarLink } from "src/layouts/base/header";
import { SideNav } from "src/layouts/base/SideNav";
import { NavItemProps, UserInfo, UserLink } from "src/layouts/base/types";
import { useDarkMode } from "src/layouts/darkMode";
import { styled } from "styled-components";
// import logo from "src/assets/logo-no-text.svg";
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

const Content = styled(Layout.Content)<{ $isDashboard: boolean; $fullBleed: boolean }>`
  margin: ${(props) => (props.$fullBleed ? "0" : props.$isDashboard ? "8px 8px 0px" : "8px")};
  padding: ${(props) => (props.$fullBleed ? "0" : "16px")};
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
  footerText: string | undefined;
  versionTag: string | undefined;
  routes: NavItemProps[];
  logout: (() => void) | undefined;
  user: UserInfo | undefined;
  headerNavbarLinks?: HeaderNavbarLink[];
  headerRightContent?: React.ReactNode;
  basePath: string;
  userLinks?: UserLink[];
  languageId: string;
  from: "portal" | "mis";
  extensionStoreData?: UiExtensionStoreData;
  operationLogUrl: string;
}>;

export const BaseLayout: React.FC<PropsWithChildren<Props>> = ({
  children,
  routes,
  user,
  logout,
  footerText,
  versionTag,
  headerNavbarLinks,
  basePath,
  userLinks,
  languageId,
  extensionStoreData,
  from,
  headerRightContent,
  operationLogUrl,
}) => {
  const router = useRouter();

  const { md } = useBreakpoint();

  const dark = useDarkMode();

  const extensions = useMemo(
    () =>
      (Array.isArray(extensionStoreData) ? extensionStoreData : extensionStoreData ? [extensionStoreData] : []).filter(
        (x) => x,
      ),
    [extensionStoreData],
  );

  const routeQuery = useMemo(
    () => getExtensionRouteQuery(dark.dark, languageId),
    [dark.dark, languageId, user?.token],
  );

  const { data: finalRoutesData } = useAsync({
    promiseFn: useCallback(async () => {
      if (extensions.length === 0) {
        return routes;
      }

      let newRoutes = routes;

      for (const extension of extensions) {
        if (!extension.manifests[from]?.rewriteNavigations) {
          continue;
        }

        const resp = await callExtensionRoute(
          rewriteNavigationsRoute(from),
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
    }, [from, routeQuery, extensions, routes]),
  });

  const finalRoutes = finalRoutesData ?? routes;

  const activeKeys = useMemo(
    () => (finalRoutes ? [...calcActiveKeys(finalRoutes, router.asPath)] : []),
    [finalRoutes, router.asPath],
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
        pathname={router.asPath}
        routes={primaryRoutes}
        user={user}
        logout={logout}
        basePath={basePath}
        userLinks={userLinks}
        languageId={languageId}
        right={headerRightContent}
        staticNavbarLinks={headerNavbarLinks}
        from={from}
        activeKeys={activeKeys}
        operationLogUrl={operationLogUrl}
      />
      <StyledLayout>
        {hasSidebar ? <SideNav activeKeys={activeKeys} pathname={router.asPath} routes={sidebarRoutes} /> : undefined}
        <ContentPart>
          <Content
            $isDashboard={router.pathname === "/dashboard"}
            // 提交作业和应用页面右侧需要全屏
            $fullBleed={router.pathname === "/jobs/submit" || router.pathname === "/apps/createApps"}
          >
            {children}
            {router.pathname === "/dashboard" ? <Footer text={footerText} versionTag={versionTag} /> : ""}
          </Content>
        </ContentPart>
      </StyledLayout>
    </Root>
  );
};
