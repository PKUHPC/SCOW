"use client";

import { arrayContainsElement } from "@scow/utils";
import { Layout, Menu } from "antd";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import React, { useCallback, useEffect, useLayoutEffect,useMemo, useRef, useState } from "react";
import { createMenuItems } from "src/layouts/base/common";
import { antdBreakpoints } from "src/layouts/base/constants";
import { CollapseMenuIcon, ExpandMenuIcon } from "src/layouts/base/header/icons";
import { NavItemProps } from "src/layouts/base/types";
import { css, styled } from "styled-components";

const { Sider } = Layout;

const breakpoint = "lg";

interface Props {
  routes: NavItemProps[];
  pathname: string;
  activeKeys: string[];
  // 如果应用于AppRouter，需传递next/navigation下的useRouter()获取到的appRouter
  // 否则维持原始逻辑，默认为pageRouter, 使用 next/router下的 Router
  appRouter?: AppRouterInstance;
}

const StyledSider = styled(Sider)<{ collapsed?: boolean }>`
  height: 100%;

  @media (max-width: ${antdBreakpoints[breakpoint]}px ) {
    z-index: 1000;

    body, html {
      overflow-x: hidden;
      overflow-y: auto;
    }

    overflow: auto;
  }

  .ant-menu {
    padding: 12px 12px 40px;
    min-height: 100%;
    border-right: 0;
  }

  .ant-menu-item:first-child {
    margin-top: 0px;
  }

  .ant-menu-title-content {
    margin-left: ${(props) => (props.collapsed ? "0px" : "8px")} !important;
  }

  /* menu间去掉左右margin, 上下margin和为8px */
  .ant-menu-item,
  .ant-menu-submenu-title {
    margin-inline: 0 !important;
    margin-block: 4px !important;
    width: 100% !important;
  }

   &.ant-layout-sider-collapsed {
    .ant-menu-item,
    .ant-menu-submenu-title {
      /* 这里的 9px 对应 18px 宽度的图标中心点 */
      padding-inline: calc(50% - 9px) !important;

      .ant-menu-item-icon {
        width: 18px !important;
        min-width: 18px !important;
        margin-inline-end: 0 !important;
      }
    }
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
  border-top: 1px #f0f0f0 solid;
  padding-left: ${(props) => props.$sidebarCollapsed ? 26 : 24}px;
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
  routes, pathname, activeKeys, appRouter,
}) => {

  const parentKeys = useMemo(() => getAllParentKeys(routes), [routes]);

  // 初始值：展开当前激活路由对应的所有父节点
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    return parentKeys.filter((key) =>
      activeKeys.some((activeKey) => activeKey.startsWith(key)),
    );
  });

  // 初始值读取窗口宽度
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= antdBreakpoints[breakpoint];
  });

  const menuFocusedRef = useRef(false);
  // 用 ref 记录 openKeys，避免 onOpenChange 闭包过期问题
  const openKeysRef = useRef(openKeys);

  // 用 useLayoutEffect 同步初始化，浏览器绘制前完成，杜绝闪烁
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const collapsed = window.innerWidth <= antdBreakpoints[breakpoint];
    setSidebarCollapsed(collapsed);
  }, []);

  useEffect(() => {
    /**
    * 点击菜单，收起其他展开的所有菜单，保持菜单聚焦简洁。
    * 仅在账户管理页面有效，且用户管理的账户数量超过三个
    */
    menuFocusedRef.current = parentKeys.length > 3 && parentKeys[0].startsWith("/accounts");
    if (menuFocusedRef.current) {
      const activeParentKey = activeKeys.find((key) => parentKeys.includes(key));
      if (activeParentKey) {
        setOpenKeys([activeParentKey]);
        openKeysRef.current = [activeParentKey];
      }
    }
  }, [activeKeys, parentKeys]);

  const onBreakpoint = useCallback((broken: boolean) => {
    // if broken, big to small. collapse the sidebar
    // if not, small to big, expand the sidebar
    setSidebarCollapsed(broken);
  }, [setSidebarCollapsed]);

  const onOpenChange = useCallback((keys) => {
    if (menuFocusedRef.current) {
      const latestOpenKey = keys.find((key) => !openKeysRef.current.includes(key));
      const nextKeys = !parentKeys.includes(latestOpenKey)
        ? keys
        : latestOpenKey ? [latestOpenKey] : [];
      setOpenKeys(nextKeys);
      openKeysRef.current = nextKeys;
    }
    else {
      setOpenKeys(keys);
      openKeysRef.current = keys;
    }
  }, [parentKeys]);

  if (!arrayContainsElement(routes)) {
    return null;
  }

  return (
    <Container $width={sidebarCollapsed ? 72 : 208}>
      <StyledSider
        onBreakpoint={onBreakpoint}
        collapsed={sidebarCollapsed}
        collapsedWidth={0}
        breakpoint={breakpoint}
        trigger={null}
      >
        <Menu
          mode="inline"
          inlineIndent={12}
          selectedKeys={activeKeys}
          {
            ...sidebarCollapsed
              ? undefined
              : { openKeys }
          }
          onOpenChange={onOpenChange}
          items={createMenuItems(routes, pathname, false, appRouter)}
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

