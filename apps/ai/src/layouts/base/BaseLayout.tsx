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

import { getExtensionRouteQuery } from "@scow/lib-web/build/extensions/common";
import { fromNavItemProps, rewriteNavigationsRoute, toNavItemProps } from "@scow/lib-web/build/extensions/navigations";
import { callExtensionRoute } from "@scow/lib-web/build/extensions/routes";
import { ExtensionManifestWithUrl,fetchManifestsWithErrorHandling, UiExtensionStoreData }
  from "@scow/lib-web/build/extensions/UiExtensionStore";
import { Footer } from "@scow/lib-web/build/layouts/base/Footer";
import { Grid, Layout } from "antd";
import { usePathname } from "next/navigation";
import React, { PropsWithChildren, useCallback, useEffect,useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useUiConfig } from "src/app/uiContext";
import { useI18n } from "src/i18n";
import { Header } from "src/layouts/base/header";
import { match } from "src/layouts/base/matchers";
import { NavItemProps } from "src/layouts/base/NavItemProps";
import { SideNav } from "src/layouts/base/SideNav";
import { useDarkMode } from "src/layouts/darkMode";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { arrayContainsElement } from "src/utils/array";
import { trpc } from "src/utils/trpc";
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

const Content = styled(Layout.Content)<{ isDashboard: boolean }>`
  margin: ${(props) => props.isDashboard ? "8px 8px 35px" : "8px"};
  padding: 16px;
  flex: 1;
  background: ${({ theme }) => theme.token.colorBgLayout};
  max-height: ${(props) => props.isDashboard ? "" : "calc(100vh - 78px)"};
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
  routes = [], children, user = undefined, headerRightContent,
}) => {
  const [finalRoutes, setFinalRoutes] = useState(routes);
  const [uiExtensionData, setUiExtensionData] = useState<UiExtensionStoreData | undefined>(undefined);

  const pathname = usePathname() ?? "";

  const { dark } = useDarkMode();

  const { md } = useBreakpoint();

  const useLogoutMutation = trpc.auth.logout.useMutation();

  const languageId = useI18n().currentLanguage.id;

  const uiExtensionConfig = usePublicConfig()?.publicConfig.UI_EXTENSION;

  const { hostname, uiConfig } = useUiConfig();
  const footerConfig = uiConfig.config?.footer;
  const footerText = (hostname && footerConfig?.hostnameMap?.[hostname])
    ?? footerConfig?.defaultText;

  const extensions = useMemo(() =>
    (Array.isArray(uiExtensionData)
      ? uiExtensionData
      : uiExtensionData ? [uiExtensionData] : []).filter((x) => x),
  [uiExtensionData]);

  const routeQuery = useMemo(() => getExtensionRouteQuery(
    dark,
    languageId,
    user?.token,
  ), [dark, languageId, user?.token]);

  useEffect(() => {
    fetchUiExtension();
  }, [uiExtensionConfig]);

  const fetchUiExtension = useCallback(async () => {
    if (!uiExtensionConfig) {
      setUiExtensionData(undefined);
      return;
    }

    let result: UiExtensionStoreData;
    if (Array.isArray(uiExtensionConfig)) {
      const promises = uiExtensionConfig.map((config) =>
        fetchManifestsWithErrorHandling(config.url, config.name),
      );
      const results = await Promise.all(promises);
      result = results.filter(Boolean) as (ExtensionManifestWithUrl & { name: string })[];
    } else {
      const resp = await fetchManifestsWithErrorHandling(uiExtensionConfig.url);
      result = resp;
    }
    const extensions = (Array.isArray(result) ? result : result ? [result] : []).filter((x) => x);
    fetchFinalRoutesData(extensions);

    setUiExtensionData(result);
  }, [uiExtensionConfig]);

  const fetchFinalRoutesData = async (extensions: ExtensionManifestWithUrl[] | []) => {
    if (extensions.length === 0) { return routes; }

    let newRoutes = routes;

    for (const extension of extensions) {
      if (!extension.manifests.ai?.rewriteNavigations) { continue; }
      const resp = await callExtensionRoute(rewriteNavigationsRoute("ai"), routeQuery, {
        navs: fromNavItemProps(newRoutes),
      }, extension.url).catch((e) => {
        console.warn(`Failed to call rewriteNavigations of extension ${extension.name ?? extension.url}. Error: `, e);
        return { 200: { navs: newRoutes } };
      });

      if (resp[200]) {
        newRoutes = toNavItemProps(newRoutes, resp[200].navs, extension.name);
      }
    }

    setFinalRoutes(newRoutes);
  };

  const firstLevelRoute = useMemo(() => finalRoutes.find((x) => match(x, pathname)), [finalRoutes, pathname]);

  const sidebarRoutes = md ? firstLevelRoute?.children : finalRoutes;

  const hasSidebar = arrayContainsElement(sidebarRoutes);

  return (
    <Root>
      <Header
        extensions={extensions}
        routeQuery={routeQuery}
        pathname={pathname}
        routes={finalRoutes ?? routes}
        user={user}
        logout={() => { useLogoutMutation.mutateAsync().then(() => { location.reload(); }); }}
        userLinks={[]}
        languageId={languageId}
        right={headerRightContent}
      />
      <StyledLayout>
        {
          (hasSidebar) ? (
            <SideNav
              pathname={pathname}
              routes={sidebarRoutes}
            />
          ) : undefined
        }
        <ContentPart>
          <Content isDashboard={pathname === "/dashboard"}>
            {children}
          </Content>
          { pathname === "/dashboard" ?
            <Footer text={footerText} versionTag={usePublicConfig()?.publicConfig?.VERSION_TAG} /> : "" }
        </ContentPart>
      </StyledLayout>
    </Root>
  );
};

