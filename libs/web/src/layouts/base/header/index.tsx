import { LinkOutlined } from "@ant-design/icons";
import { Space } from "antd";
import { join } from "path";
import React, { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { ExtensionRouteQuery, isUrl } from "src/extensions/common";
import { NavbarLink, navbarLinksRoute } from "src/extensions/navbarLinks";
import { callExtensionRoute } from "src/extensions/routes";
import { ExtensionManifestWithUrl } from "src/extensions/UiExtensionStore";
import { antdBreakpoints } from "src/layouts/base/constants";
import { BigScreenMenu } from "src/layouts/base/header/BigScreenMenu";
import { HeaderItem, JumpToAnotherLink } from "src/layouts/base/header/components";
import { Logo } from "src/layouts/base/header/Logo";
import { SystemSelect } from "src/layouts/base/header/SystemSelect";
import { UserIndicator } from "src/layouts/base/header/UserIndicator";
import { NavItemProps, UserInfo, UserLink } from "src/layouts/base/types";
import { NavIcon } from "src/layouts/icon";
import { styled } from "styled-components";

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
  width: 100%;
  color: #434343;
`;

const MenuPart = styled(HeaderItem)`
  flex: 1;
  min-width: 0;
`;

const HeaderLogo = styled(HeaderItem)`
  padding: 0 16px;
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
  align-items: center;
`;

const RightContentPart = styled.div`
  display: flex;
  flex-direction: row;
  flex-grow: 0;
  align-items: center;
`;

const IndicatorPart = styled(HeaderItem)`
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

interface Props {
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
  showOperationLog?: boolean;
  operationLogUrl?: string;
}

interface SourcedHeaderNavbarLink {
  link: HeaderNavbarLink;
  extension: ExtensionManifestWithUrl;
  priority: number;
}

export const Header: React.FC<Props> = ({
  routes,
  pathname,
  user,
  logout,
  basePath,
  userLinks,
  languageId,
  activeKeys,
  right,
  staticNavbarLinks,
  extensions,
  from,
  routeQuery,
  showOperationLog,
  operationLogUrl,
}) => {
  const [links, setLinks] = useState<SourcedHeaderNavbarLink[]>([]);

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
      <HeaderLogo>
        <Space size="middle">
          <Logo basePath={basePath} />
        </Space>
      </HeaderLogo>
      <MenuPart>
        <BigScreenMenu pathname={pathname} activeKeys={activeKeys} routes={routes} />
        <MenuPartPlaceholder />
      </MenuPart>
      <RightContentPart>
        <LinksPart>{navbarLinkComponents}</LinksPart>
        <SystemSelect links={staticNavbarLinks ?? []}></SystemSelect>
        {right}
        <IndicatorPart>
          <UserIndicator
            user={user}
            logout={logout}
            userLinks={userLinks}
            languageId={languageId}
            showOperationLog={showOperationLog}
            operationLogUrl={operationLogUrl}
          />
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
  const { reload } = useAsync({
    promiseFn: useCallback(async () => {
      const resp = await callExtensionRoute(navbarLinksRoute(from), routeQuery, {}, extension.url).catch((e) => {
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

      const navbarLinksConfig = extension.manifests[from]?.navbarLinks;

      if (
        typeof navbarLinksConfig === "object" &&
        navbarLinksConfig?.enabled &&
        navbarLinksConfig.autoRefresh?.enabled
      ) {
        setTimeout(reload, navbarLinksConfig.autoRefresh.intervalMs);
      }
    }, [from, routeQuery, extension]),
  });

  return <></>;
};
