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

"use client";

import { LinkOutlined } from "@ant-design/icons";
import { arrayContainsElement } from "@scow/utils";
import { Grid, Layout } from "antd";
import { useRouter } from "next/router";
import React, { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { ScowExtensionRouteContext } from "src/extensions/common";
import { NavbarLink, navbarLinksRoute } from "src/extensions/navbarLinks";
import { fromNavItemProps, rewriteNavigationsRoute, toNavItemProps } from "src/extensions/navigations";
import { callExtensionRoute } from "src/extensions/routes";
import { UiExtensionStoreData } from "src/extensions/UiExtensionStore";
import { Footer } from "src/layouts/base/Footer";
import { Header, HeaderNavbarLink } from "src/layouts/base/header";
import { match } from "src/layouts/base/matchers";
import { SideNav } from "src/layouts/base/SideNav";
import { NavItemProps, UserInfo, UserLink } from "src/layouts/base/types";
import { useDarkMode } from "src/layouts/darkMode";
import { NavIcon } from "src/layouts/icon";
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
  footerText: string;
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

  const extensions = useMemo(() => Array.isArray(extensionStoreData)
    ? extensionStoreData
    : extensionStoreData ? [extensionStoreData] : [], [extensionStoreData]);

  const routeQuery = useMemo(() => ({
    scowDark: dark.dark ? "true" : "false",
    scowLangId: languageId,
    scowUserToken: user?.token,
  }) as ScowExtensionRouteContext, [dark.dark, languageId, user?.token]);

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

  const firstLevelRoute = finalRoutes.find((x) => match(x, router.asPath));

  const sidebarRoutes = md ? firstLevelRoute?.children : finalRoutes;

  const hasSidebar = arrayContainsElement(sidebarRoutes);

  // navbar links
  const { data: extensionNavbarLinks } = useAsync({
    promiseFn: useCallback(async () => {
      if (extensions.length === 0) { return undefined; }

      const result = await Promise.all(extensions.map(async (extension) => {
        const resp = await callExtensionRoute(navbarLinksRoute(from), routeQuery, {}, extension.url)
          .catch((e) => {
            console.warn(`Failed to call navbarLinks of extension ${extension.name ?? extension.url}. Error: `, e);
            return { 200: { navbarLinks: []} };
          });

        if (resp[200]) {
          return resp[200].navbarLinks;
        }
      }));

      const filtered = result.flat().filter((x) => x) as NavbarLink[];

      // order by priority and index. sort is stable, index is preserved
      filtered.sort((a, b) => {
        return b.priority - a.priority;
      });

      return filtered.map((x) => ({
        href: x.href,
        text: x.text,
        icon: x.icon ? <NavIcon src={x.icon.src} alt={x.icon.alt ?? ""} /> : <LinkOutlined />,
      }) satisfies HeaderNavbarLink);

    }, [from, routeQuery, extensions]),
  });

  return (
    <Root>
      <Header
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
        navbarLinks={[...extensionNavbarLinks ?? [], ...headerNavbarLinks ?? []]}
      />
      <StyledLayout>
        {
          hasSidebar ? (
            <SideNav
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
          <Footer text={footerText} versionTag={versionTag}/>
        </ContentPart>
      </StyledLayout>
    </Root>
  );
};

