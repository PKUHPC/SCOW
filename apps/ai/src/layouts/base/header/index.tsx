"use client";

import { LinkOutlined } from "@ant-design/icons";
import { ExtensionRouteQuery, isUrl } from "@scow/lib-web/build/extensions/common";
import { NavbarLink, navbarLinksRoute } from "@scow/lib-web/build/extensions/navbarLinks";
import { callExtensionRoute } from "@scow/lib-web/build/extensions/routes";
import { ExtensionManifestWithUrl } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { calcActiveKeys } from "@scow/lib-web/build/layouts/base/common";
import { BigScreenMenu } from "@scow/lib-web/build/layouts/base/header/BigScreenMenu";
import { JumpToAnotherLink } from "@scow/lib-web/build/layouts/base/header/components";
import { NavItemProps, UserLink } from "@scow/lib-web/build/layouts/base/types";
import { Space } from "antd";
import { join } from "path";
import React, { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { antdBreakpoints } from "src/layouts/base/constants";
import { Logo } from "src/layouts/base/header/Logo";
import { NavIcon } from "src/layouts/icon";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { styled } from "styled-components";

import { UserIndicator } from "./UserIndicator";

interface ComponentProps {
  homepage?: boolean;
}

const Container = styled.header<ComponentProps>`
  height: 56px;
  display: flex;
  padding: 0 4px;
  box-shadow: 0px 2px 2px 0px #0000000d;
  z-index: 50;
  align-items: center;
  background-color: ${({ theme }) => theme.token.colorBgContainer};
  font-size: 18px;
  color: #434343;
`;

const HeaderItem = styled.div`
  padding: 0 16px;
  /* justify-content: center; */
`;

const MenuPart = styled.div`
  flex: 1;
  min-width: 0;
`;

const LinksPart = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const MenuPartPlaceholder = styled.div`
  flex: 1;
  @media (min-width: ${antdBreakpoints.md}px) {
    display: none;
  }
`;

const IndicatorPart = styled(HeaderItem)`
  justify-self: flex-end;
  flex-wrap: nowrap;
  margin: 0 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 14px;
  &:hover {
    background-color: #59595914;
    border-radius: 8px;
  }
`;

export interface HeaderNavbarLink {
  icon: React.ReactNode;
  href: string;
  text: string | React.ReactNode;
  crossSystem?: boolean;
  isActive?: boolean;
}

interface SourcedHeaderNavbarLink {
  link: HeaderNavbarLink;
  extension: ExtensionManifestWithUrl;
  priority: number;
}

interface Props {
  routes?: NavItemProps[];
  logout: (() => void) | undefined;
  user: ClientUserInfo | undefined;
  userLinks?: UserLink[];
  pathname: string;
  languageId: string;
  right?: React.ReactNode;
  extensions: ExtensionManifestWithUrl[];
  routeQuery: ExtensionRouteQuery;
  operationLogUrl?: string;
}

export const Header: React.FC<Props> = ({
  routes,
  logout,
  user,
  pathname,
  userLinks,
  languageId,
  right,
  extensions,
  routeQuery,
  operationLogUrl,
}) => {
  const [links, setLinks] = useState<SourcedHeaderNavbarLink[]>([]);

  const selectedKeys = useMemo(() => {
    if (!routes) return [];
    const activeKeysSet = calcActiveKeys(routes, pathname);
    return Array.from(activeKeysSet);
  }, [routes, pathname]);

  const onFetched = (extension: ExtensionManifestWithUrl) => (data: NavbarLink[]) => {
    setLinks((links) => {
      // remove all existing links from the same extension
      links = links.filter((x) => x.extension !== extension);
      // append newly got links
      links.push(
        ...data.map((x) => ({
          link: {
            href: x.path,
            text: x.text,
            icon: x.icon ? <NavIcon src={x.icon.src} alt={x.icon.alt ?? ""} /> : <LinkOutlined />,
          },
          extension,
          priority: x.priority,
        })),
      );

      // order by priority and index. sort is stable, index is preserved
      links.sort((a, b) => {
        return b.priority - a.priority;
      });
      return links;
    });
  };

  const navbarLinks = [...links.map((x) => x.link)];

  const hideLinkText = navbarLinks && navbarLinks.length >= 5;
  const navbarLinkComponents = navbarLinks?.map(
    (x, i) => {
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
    },
    [navbarLinks],
  );

  return (
    <Container>
      {extensions.map((extension) => {
        const navbarLinksConfig = extension.manifests.ai?.navbarLinks;
        if (navbarLinksConfig === true || (typeof navbarLinksConfig === "object" && navbarLinksConfig?.enabled)) {
          return (
            <NavbarLinkFetcher
              key={extension.name ?? extension.url}
              extension={extension}
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
          <Logo />
        </Space>
      </HeaderItem>
      <MenuPart>
        <BigScreenMenu pathname={pathname} routes={routes} activeKeys={selectedKeys} />
        <MenuPartPlaceholder />
      </MenuPart>
      <LinksPart>{navbarLinkComponents}</LinksPart>
      {right}
      <IndicatorPart>
        <UserIndicator
          user={user}
          logout={logout}
          userLinks={userLinks}
          languageId={languageId}
          operationLogUrl={operationLogUrl}
        />
      </IndicatorPart>
    </Container>
  );
};

interface FetcherProps {
  extension: ExtensionManifestWithUrl;
  routeQuery: ExtensionRouteQuery;
  onDataFetched: (links: NavbarLink[]) => void;
}

const NavbarLinkFetcher = ({ extension, routeQuery, onDataFetched }: FetcherProps) => {
  const { reload } = useAsync({
    promiseFn: useCallback(async () => {
      const resp = await callExtensionRoute(navbarLinksRoute("ai"), routeQuery, {}, extension.url).catch((e) => {
        console.warn(`Failed to call navbarLinks of extension ${extension.name ?? extension.url}. Error: `, e);
        return { 200: { navbarLinks: [] as NavbarLink[] } };
      });

      const data = resp[200]?.navbarLinks?.map((x) => {
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

      const navbarLinksConfig = extension.manifests.ai?.navbarLinks;

      if (
        typeof navbarLinksConfig === "object" &&
        navbarLinksConfig?.enabled &&
        navbarLinksConfig.autoRefresh?.enabled
      ) {
        setTimeout(reload, navbarLinksConfig.autoRefresh.intervalMs);
      }
    }, [routeQuery, extension]),
  });

  return <></>;
};
