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

import { arrayContainsElement } from "@scow/utils";
import { Tooltip } from "antd";
import { ItemType } from "antd/es/menu/interface";
import Link from "next/link";
import Router from "next/router";
import React from "react";
import { match } from "src/layouts/base/matchers";
import { NavItemProps } from "src/layouts/base/types";

export const iconToNode = (Icon: any) => {
  return (
    <span style={{ maxWidth: "18px", maxHeight: "36px" }}>
      {React.isValidElement(Icon)
        ? Icon
        : <Icon style={{ transform: "scale(0.9)" }} />}
    </span>
  );
};

export const EXTERNAL_URL_PREFIX = ["http://", "https://"];

export function createMenuItems(
  routes: NavItemProps[],
  pathname: string,
  parentClickable: boolean,
) {

  function createMenuItem(route: NavItemProps): ItemType {
    const handleClick = () => {
      const target = route.clickToPath ?? route.path;
      route.handleClick?.();
      if (route.openInNewPage) {
        window.open(target);
      } else {
        if (EXTERNAL_URL_PREFIX.some((pref) => target.startsWith(pref))) {
          window.location.href = target;
        } else {
          void Router.push(target);
        }
      }
    };

    if (arrayContainsElement(route.children)) {
      return {
        icon: iconToNode(route.Icon),
        key: route.path,
        title: route.text,
        label:
        <Tooltip
          title={route.text?.length > 13 ? route.text : null}
          mouseEnterDelay={0.3}
          placement="bottomLeft"
        >{route.text}
        </Tooltip>,
        onTitleClick:(route.clickable ?? parentClickable)
          ? handleClick
          : undefined,
        children: createMenuItems(route.children, pathname, parentClickable),
      } as ItemType;
    }

    return {
      icon: iconToNode(route.Icon),
      key: route.path,
      label:
        <Tooltip
          title={route.text?.length > 13 ? route.text : null}
          mouseEnterDelay={0.3}
          placement="bottomLeft"
        >{route.text}
        </Tooltip>,
      onClick: handleClick,
    } as ItemType;
  }

  const items = routes
    .filter((x) => !x.hideIfNotActive || match(x, pathname))
    .map((r) => createMenuItem(r));

  return items;
}

// 创建无子元素的a标签菜单项
export function createLinkMenuItems(routes: NavItemProps[], pathname: string): ItemType[] {
  return routes.filter((x) => !x.hideIfNotActive || match(x, pathname)).map((route) => {
    const target = route.clickToPath ?? route.path;

    return {
      icon: iconToNode(route.Icon),
      key: route.path,
      label: (
        <Link
          href={target}
          passHref
          target={route.openInNewPage ? "_blank" : undefined}
          rel={route.openInNewPage ? "noopener noreferrer" : undefined}
          onClick={() => route.handleClick?.()}
        >
          <Tooltip
            title={route.text?.length > 13 ? route.text : null}
            mouseEnterDelay={0.3}
            placement="bottomLeft"
          >
            {route.text}
          </Tooltip>
        </Link>
      ),
    } as ItemType;
  });
}

export function calcActiveKeys(links: NavItemProps[], pathname: string): Set<string> {

  const selectedKeys = new Set<string>();

  for (const link of links) {
    if (arrayContainsElement(link.children)) {
      const childrenSelectedKeys = calcActiveKeys(link.children, pathname);
      for (const childKey of childrenSelectedKeys) {
        selectedKeys.add(childKey);
      }
    }

    if (
      link.children?.some((x) => selectedKeys.has(x.path)) ||
      (link.path === "/" && pathname === "/") ||
        (link.path !== "/" && link.path !== "" && match(link, pathname))
    ) {
      selectedKeys.add(link.path);
    }
  }

  return selectedKeys;
}
