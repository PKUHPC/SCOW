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

import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Space } from "antd";
import React from "react";
import { antdBreakpoints } from "src/layouts/base/constants";
import { BigScreenMenu } from "src/layouts/base/header/BigScreenMenu";
import { HeaderItem, JumpToAnotherLink } from "src/layouts/base/header/components";
import { Logo } from "src/layouts/base/header/Logo";
import { UserIndicator } from "src/layouts/base/header/UserIndicator";
import { NavItemProps, UserInfo, UserLink } from "src/layouts/base/types";
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

export type HeaderNavbarLink = {
  icon: React.ReactNode;
  href: string;
  text: string;
}

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
  navbarLinks?: HeaderNavbarLink[];
}


export const Header: React.FC<Props> = ({
  hasSidebar, routes,
  setSidebarCollapsed, sidebarCollapsed,
  pathname, user, logout,
  basePath, userLinks,
  languageId,
  navbarLinks, right,
}) => {

  const hideLinkText = navbarLinks && navbarLinks.length >= 5;

  const navbarLinkComponents = navbarLinks?.map((x, i) => {

    return (
      <JumpToAnotherLink
        key={i}
        icon={x.icon}
        href={x.href}
        text={x.text}
        hideText={hideLinkText}
      />
    );
  }, [navbarLinks]);

  return (
    <Container>
      <HeaderItem>
        <Space size="middle">
          {hasSidebar
            ? (
              <a onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                {React.createElement(
                  sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined)}
              </a>
            ) : <span/>
          }
          <Logo basePath={basePath} />
        </Space>
      </HeaderItem>
      <MenuPart>
        <BigScreenMenu
          pathname={pathname}
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
          <UserIndicator user={user} logout={logout} userLinks={userLinks} languageId={languageId}/>
        </IndicatorPart>
      </RightContentPart>
    </Container>
  );
};
