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

import { UserLink } from "@scow/lib-web/build/layouts/base/types";
import { Space } from "antd";
import React from "react";
import { antdBreakpoints } from "src/layouts/base/constants";
import { BigScreenMenu } from "src/layouts/base/header/BigScreenMenu";
import { Logo } from "src/layouts/base/header/Logo";
import { NavItemProps } from "src/layouts/base/NavItemProps";
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
  box-shadow: 0px 2px 2px 0px #0000000D;
  z-index: 50;
  align-items: center;
  background-color: ${({ theme }) => theme.token.colorBgContainer};
  font-size:18px;
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
  &:hover{
    background-color: #59595914;
    border-radius: 8px;
  }
`;

interface Props {
  routes?: NavItemProps[];
  logout: (() => void) | undefined;
  user: ClientUserInfo | undefined;
  userLinks?: UserLink[];
  pathname: string;
  languageId: string,
  right?: React.ReactNode;
}

export const Header: React.FC<Props> = ({
  routes,
  logout,
  user,
  pathname,
  userLinks,
  languageId,
  right,
}) => {

  return (
    <Container>
      <HeaderItem>
        <Space size="middle">
          <Logo />
        </Space>
      </HeaderItem>
      <MenuPart>
        <BigScreenMenu
          pathname={pathname}
          routes={routes}
        />
        <MenuPartPlaceholder />
      </MenuPart>
      {right}
      <IndicatorPart>
        <UserIndicator user={user} logout={logout} userLinks={userLinks} languageId={languageId} />
      </IndicatorPart>

    </Container>
  );
};
