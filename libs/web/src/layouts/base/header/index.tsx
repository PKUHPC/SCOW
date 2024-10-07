/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * OpenSCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Space } from "antd";
import { join } from "path";
import React, { useCallback, useRef, useState } from "react";
import { useAsync } from "react-async";
import { ExtensionRouteQuery, isUrl } from "src/extensions/common";
import { NavbarLink, navbarLinksRoute } from "src/extensions/navbarLinks";
import { callExtensionRoute } from "src/extensions/routes";
import { ExtensionManifestWithUrl } from "src/extensions/UiExtensionStore";
import { antdBreakpoints } from "src/layouts/base/constants";
import { BigScreenMenu } from "src/layouts/base/header/BigScreenMenu";
import { HeaderItem, JumpToAnotherLink } from "src/layouts/base/header/components";
import { Logo } from "src/layouts/base/header/Logo";
import { UserIndicator } from "src/layouts/base/header/UserIndicator";
import { NavItemProps, UserInfo, UserLink } from "src/layouts/base/types";
import { NavIcon } from "src/layouts/icon";
import { styled } from "styled-components";

interface ComponentProps {
  homepage?: boolean;
}

const Container = styled.header<ComponentProps>`
  display: flex;
  padding: 0 4px;
  box-shadow: ${({ theme }) => theme.token.boxShadow };
  z-index: 50;
  align-items: center;
  background-color: ${({ theme }) => theme.token.colorBgContainer};
  font-weight:700;
  font-size:18px;
  width: 100%;
`;


const MenuPart = styled(HeaderItem)`
  flex: 1;
  min-width: 0;
`;

const MenuPartPlaceholder = styled.div`
  flex: 1;
  @media (min-width: ${antdBreakpoints.md}px) {
    display: none;
  }
`;

const LinksPart = styled.div`
  display: flex;
  flex-direction: row;
`;

const RightContentPart = styled.div`
  display: flex;
  flex-direction: row;
  flex-grow: 0;
  align-items: center;
`;

const IndicatorPart = styled(HeaderItem)`
  flex-wrap: nowrap;
`;

export interface HeaderNavbarLink {
  icon: React.ReactNode;
  href: string;
  text: string;
  crossSystem?: boolean;
};

interface Props {
  hasSidebar: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarCollapsed: boolean;
  routes?: NavItemProps[];
  user: UserInfo | undefined;
  logout: (() => void) | undefined;
  pathname: string;
  basePath: string;
  userLinks?: UserLink[];
  languageId: string;
  right?: React.ReactNode;
  staticNavbarLinks?: HeaderNavbarLink[];
  extensions: ExtensionManifestWithUrl[];
  from: "mis" | "portal";
  routeQuery: ExtensionRouteQuery;
  activeKeys: string[];
}

interface SourcedHeaderNavbarLink {
  link: HeaderNavbarLink;
  extension: ExtensionManifestWithUrl;
  priority: number;
};

export const Header: React.FC<Props> = ({
  hasSidebar, routes,
  setSidebarCollapsed, sidebarCollapsed,
  pathname, user, logout,
  basePath, userLinks,
  languageId, activeKeys,
  right, staticNavbarLinks,
  extensions,
  from, routeQuery,
}) => {

  const [links, setLinks] = useState<SourcedHeaderNavbarLink[]>([]);

  const onFetched = (extension: ExtensionManifestWithUrl) => (data: NavbarLink[]) => {
    setLinks((links) => {

      // remove all existing links from the same extension
      links = links.filter((x) => x.extension !== extension);

      // append newly got links
      links.push(...data.map((x) => ({ link: {
        href: x.path,
        text: x.text,
        icon: x.icon ? <NavIcon src={x.icon.src} alt={x.icon.alt ?? ""} /> : <LinkOutlined />,
      }, extension, priority: x.priority })));

      // order by priority and index. sort is stable, index is preserved
      links.sort((a, b) => {
        return b.priority - a.priority;
      });

      return links;
    });
  };

  const navbarLinks = [...links.map((x) => x.link), ...(staticNavbarLinks ?? [])];

  const hideLinkText = navbarLinks && navbarLinks.length >= 5;

  const navbarLinkComponents = navbarLinks?.map((x, i) => {

    return (
      <JumpToAnotherLink
        key={i}
        icon={x.icon}
        href={x.href}
        text={x.text}
        crossSystem={x.crossSystem}
        hideText={hideLinkText}
      />
    );
  }, [navbarLinks]);

  return (
    <Container>
      {extensions.map((extension) => {
        const navbarLinksConfig = extension.manifests[from]?.navbarLinks;

        if (navbarLinksConfig === true || (typeof navbarLinksConfig === "object" && navbarLinksConfig?.enabled)) {
          return (
            <NavbarLinkFetcher
              key={extension.name ?? extension.url}
              extension={extension}
              from={from}
              routeQuery={routeQuery}
              onDataFetched={onFetched(extension)}
            />
          );
        } else {
          return undefined;
        }
      })}
      <HeaderItem>
        <Space size="middle">
          {hasSidebar
            ? (
              <a onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                {React.createElement(
                  sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined)}
              </a>
            ) : <span />
          }
          <Logo basePath={basePath} />
        </Space>
      </HeaderItem>
      <MenuPart>
        <BigScreenMenu
          pathname={pathname}
          activeKeys={activeKeys}
          routes={routes}
        />
        <MenuPartPlaceholder />
      </MenuPart>
      <RightContentPart>
        <LinksPart>
          {navbarLinkComponents}
        </LinksPart>
        {right}
        <IndicatorPart>
          <UserIndicator user={user} logout={logout} userLinks={userLinks} languageId={languageId} />
        </IndicatorPart>
      </RightContentPart>
    </Container>
  );
};


interface FetcherProps {
  extension: ExtensionManifestWithUrl;
  from: "mis" | "portal";
  routeQuery: ExtensionRouteQuery;
  onDataFetched: (links: NavbarLink[]) => void;
}

const NavbarLinkFetcher = ({ extension, from, routeQuery, onDataFetched }: FetcherProps) => {

  const lastResultRef = useRef<NavbarLink[] | undefined>(undefined);

  const { reload } = useAsync({
    promiseFn: useCallback(async () => {
      const resp = await callExtensionRoute(navbarLinksRoute(from), routeQuery, {}, extension.url)
        .then((resp) => {
          const result = resp[200]?.navbarLinks;
          lastResultRef.current = result;
          return result;
        })
        .catch((e) => {
          console.warn(`Failed to call navbarLinks of extension ${extension.name ?? extension.url}. Error: `, e);
          return lastResultRef.current;
        });

      const data = resp?.map((x) => {

        if (!isUrl(x.path)) {
          const parts = ["/extensions"];

          if (extension.name) {
            parts.push(extension.name);
          }

          parts.push(x.path);
          x.path = join(...parts);
        }

        return x;
      });

      onDataFetched(data ?? []);

      const navbarLinksConfig = extension.manifests[from]?.navbarLinks;

      if (typeof navbarLinksConfig === "object"
        && navbarLinksConfig?.enabled && navbarLinksConfig.autoRefresh?.enabled) {
        setTimeout(reload, navbarLinksConfig.autoRefresh.intervalMs);
      }

    }, [from, routeQuery, extension]),
  });

  return <></>;
};
