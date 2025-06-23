
"use client";

import { Menu } from "antd";
import React, { useMemo } from "react";
import { calcSelectedKeys, createMenuItems } from "src/layouts/base/common";
import { antdBreakpoints } from "src/layouts/base/constants";
import { NavItemProps } from "src/layouts/base/NavItemProps";
import { arrayContainsElement } from "src/utils/array";
import { styled } from "styled-components";

const Container = styled.div`

  @media (max-width: ${antdBreakpoints.md}px) {
    display: none;
  }

  width: 100%;

  .ant-menu-item-icon svg{
    font-size:1.42em;
  }

  .anticon img{
    font-size:1.42em;
  }


  .ant-menu-item {
    display: flex !important;
    padding-left: 16px !important;
    border-radius: 8px !important;
    &:hover{
      background-color: #59595914 !important;
    }
  }

  .ant-menu-submenu-selected::after, .ant-menu-submenu::after, .ant-menu-item:hover::after,
  .ant-menu-item-selected::after, .ant-menu-item::after {
    border-bottom: none !important;
  }

  .ant-menu-horizontal {
    line-height: 36px;
  }

  .ant-menu-submenu-title {
    display: flex !important;
    padding: 0 12px;
    &:hover{
      background-color: #59595914 !important;
    }
  }

  .ant-menu-submenu {
    display: flex !important;
    padding: 0 6px !important;
  }
`;

interface Props {
  routes?: NavItemProps[];
  className?: string;
  pathname: string;
}
export const BigScreenMenu: React.FC<Props> = ({
  routes, className, pathname,
}) => {

  const selectedKeys = useMemo(() =>
    routes
      ? calcSelectedKeys(routes, pathname)
      : []
  , [routes, pathname]);

  return (
    <Container className={className}>
      {
        arrayContainsElement(routes)
          ? (
            <Menu
              style={{ minWidth: 0, flex: "auto", border: 0 }}
              theme="light"
              mode="horizontal"
              selectedKeys={selectedKeys}
              // forceSubMenuRender
              items={createMenuItems(routes, true)}
            />
          ) : undefined
      }
    </Container>
  );
};
