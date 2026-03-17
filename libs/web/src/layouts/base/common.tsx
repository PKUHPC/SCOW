import { arrayContainsElement } from "@scow/utils";
import { Tooltip } from "antd";
import { ItemType } from "antd/es/menu/interface";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
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
  appRouter?: AppRouterInstance,
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
          // appRouter模式
          if (appRouter) {
            appRouter.push(target);
            // pageRouter模式
          } else {
            void Router.push(target);
          }

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
        onTitleClick: (route.clickable ?? parentClickable)
          ? handleClick
          : undefined,
        children: createMenuItems(route.children, pathname, parentClickable, appRouter),
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

