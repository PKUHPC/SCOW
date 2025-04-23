"use client";

import { arrayContainsElement } from "@scow/utils";
import { Grid, Layout } from "antd";
import { useRouter } from "next/router";
import React, { PropsWithChildren, useCallback, useMemo, useState } from "react";
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

const Content = styled(Layout.Content)`
  margin: 8px;
  padding: 16px;
  flex: 1;
  background: ${({ theme }) => theme.token.colorBgLayout};
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
  languageId: string,
  from: "portal" | "mis";
  extensionStoreData?: UiExtensionStoreData;
}>;

export const BaseLayout: React.FC<PropsWithChildren<Props>> = ({
  children, footerText, versionTag, routes, user, logout,
  headerNavbarLinks, basePath, userLinks, languageId,
  extensionStoreData, from, headerRightContent,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const router = useRouter();

  const { md } = useBreakpoint();

  const dark = useDarkMode();

  const extensions = useMemo(() =>
    (Array.isArray(extensionStoreData)
      ? extensionStoreData
      : extensionStoreData ? [extensionStoreData] : []).filter((x) => x),
  [extensionStoreData]);

  const routeQuery = useMemo(() => getExtensionRouteQuery(
    dark.dark,
    languageId,
    user?.token,
  ), [dark.dark, languageId, user?.token]);

  const { data: finalRoutesData } = useAsync({
    promiseFn: useCallback(async () => {
      if (extensions.length === 0) { return routes; }

      let newRoutes = routes;

      for (const extension of extensions) {
        if (!extension.manifests[from]?.rewriteNavigations) { continue; }

        const resp = await callExtensionRoute(rewriteNavigationsRoute(from), routeQuery, {
          navs: fromNavItemProps(newRoutes),
        }, extension.url).catch((e) => {
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

  const activeKeys = useMemo(() =>
    finalRoutes
      ? [...calcActiveKeys(finalRoutes, router.asPath)]
      : []
  , [finalRoutes, router.asPath]);

  const firstLevelRoute = finalRoutes.find((x) => activeKeys.includes(x.path));

  const sidebarRoutes = md ? firstLevelRoute?.children : finalRoutes;

  const hasSidebar = arrayContainsElement(sidebarRoutes);

  return (
    <Root>
      <Header
        extensions={extensions}
        routeQuery={routeQuery}
        setSidebarCollapsed={setSidebarCollapsed}
        pathname={router.asPath}
        sidebarCollapsed={sidebarCollapsed}
        hasSidebar={hasSidebar}
        routes={finalRoutes ?? routes}
        user={user}
        logout={logout}
        basePath={basePath}
        userLinks={userLinks}
        languageId={languageId}
        right={headerRightContent}
        staticNavbarLinks={headerNavbarLinks}
        from={from}
        activeKeys={activeKeys}
      />
      <StyledLayout>
        {
          hasSidebar ? (
            <SideNav
              activeKeys={activeKeys}
              pathname={router.asPath}
              collapsed={sidebarCollapsed}
              routes={sidebarRoutes}
              setCollapsed={setSidebarCollapsed}
            />
          ) : undefined
        }
        <ContentPart>
          <Content>
            {children}
          </Content>
          <Footer text={footerText} versionTag={versionTag} />
        </ContentPart>
      </StyledLayout>
    </Root>
  );
};

