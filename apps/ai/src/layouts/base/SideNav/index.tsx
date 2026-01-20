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

import { Layout, Menu } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { CollapseMenuIcon, ExpandMenuIcon } from "src/icons/headIcons";
import { calcSelectedKeys, createMenuItems } from "src/layouts/base/common";
import { antdBreakpoints } from "src/layouts/base/constants";
import { arrayContainsElement } from "src/utils/array";
import { useDidUpdateEffect } from "src/utils/hooks";
import { css, styled } from "styled-components";

import { NavItemProps } from "../NavItemProps";
import BodyMask from "./BodyMask";

const { Sider } = Layout;

const breakpoint = "lg";

interface Props {
  routes: NavItemProps[];
  pathname: string;

}

const StyledSider = styled(Sider)`

  @media (max-width: ${antdBreakpoints[breakpoint]}px ) {
    z-index: 1000;

    body, html {
      overflow-x: hidden;
      overflow-y: auto;
    }

    overflow: auto;
  }

  height: 100%;


  .ant-menu {
    padding: 12px 8px;
  }

  .ant-menu-item {
    padding-left: 14px;
  }

  .ant-menu-item:first-child {
    margin-top: 0px;
  }

  .ant-menu-title-content {
    margin-left: 4px;
  }

  .ant-layout .ant-layout-sider {
    background: transparent !important;
  }
`;

const Container = styled.div<{ $width?: number }>`
  background: ${({ theme }) => theme.token.colorBgContainer};
  font-weight: 400;
  z-index: 1000;
  border: 1px solid ${({ theme }) => theme.token.colorBgLayout};

  .ant-layout-sider {
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: #D9D9D9;
      border-radius: 6px;
      background-clip: padding-box;
      border: 1px solid transparent
    }
    background: initial !important;
    max-height: calc(100vh - 110px);
    overflow: auto;
    ${(props) => props.$width !== undefined && css`
      width: ${props.$width}px !important;
      max-width: ${props.$width}px !important;
    `}
  }
`;

const SidebarIconContainer = styled.div<{ $sidebarCollapsed: boolean }>`
  @media (max-width: ${antdBreakpoints[breakpoint]}px ) {
    position: relative;
    z-index: 1000;
    height: 54px;
    background: ${({ theme }) => theme.token.colorBgContainer};
  }
  border-top: 1px #f0f0f0  solid;
  padding-left: ${(props) => props.$sidebarCollapsed ? 26 : 35}px;
  padding-top: 17px;
`;

function getAllParentKeys(routes: NavItemProps[]): string[] {
  return routes.map((x) => {
    if (arrayContainsElement(x.children)) {
      return [...getAllParentKeys(x.children), x.path];
    } else {
      return [];
    }
  }).flat();
}

export const SideNav: React.FC<Props> = ({
  routes,pathname,
}) => {

  const parentKeys = useMemo(() => getAllParentKeys(routes), [routes]);

  const [openKeys, setOpenKeys] = useState(parentKeys);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useDidUpdateEffect(() => {
    setOpenKeys(parentKeys);
  }, [parentKeys]);


  const selectedKeys = useMemo(() => calcSelectedKeys(routes, pathname), [routes, pathname]);

  useEffect(() => {
    if (window.innerWidth <= antdBreakpoints[breakpoint]) {
      setSidebarCollapsed(true);
    }
  }, [pathname]);

  if (!arrayContainsElement(routes)) {
    return null;
  }
  return (
    <Container $width={sidebarCollapsed ? 72 : 208}>
      <BodyMask
        onClick={() => setSidebarCollapsed(true)}
        sidebarShown={!sidebarCollapsed}
        breakpoint={antdBreakpoints[breakpoint]}
      />
      <StyledSider
        collapsed={sidebarCollapsed}
        collapsedWidth={0}
        breakpoint={breakpoint}
        trigger={null}
      >
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          {
            ...sidebarCollapsed
              ? undefined
              : { openKeys }
          }
          onOpenChange={setOpenKeys}
          // defaultOpenKeys={parentKeys}
          style={{ height: "100%", borderRight: 0 }}
          items={createMenuItems(routes, false)}
        >
        </Menu>
      </StyledSider>
      <SidebarIconContainer $sidebarCollapsed={sidebarCollapsed}>
        <a onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {React.createElement(
            sidebarCollapsed ? ExpandMenuIcon : CollapseMenuIcon)}
        </a>
      </SidebarIconContainer>
    </Container>
  );
};
