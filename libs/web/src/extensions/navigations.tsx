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

import { LinkOutlined } from "@ant-design/icons";
import { join } from "path";
import { isUrl, ScowExtensionRouteContext } from "src/extensions/common";
import { defineExtensionRoute } from "src/extensions/routes";
import { NavItemProps } from "src/layouts/base/types";
import { NavIcon } from "src/layouts/icon";
import { z } from "zod";

export const BaseNavItem = z.object({
  path: z.string({ description: "目标路径。如果是外部链接，需要以 http:// 或 https:// 开头。如果是SCOW的路径，无需加base path" }),
  clickToPath: z.string().optional(),
  text: z.string(),
  icon: z.optional(z.object({
    src: z.string(),
    alt: z.string().optional(),
  })),
  openInNewPage: z.boolean().optional(),
});

export type NavItem = z.infer<typeof BaseNavItem> & {
  children?: NavItem[];
}

export const NavItem = BaseNavItem.extend({
  children: z.lazy(() => NavItem).array().optional(),
});

export const rewriteNavigationsRoute = (from: "portal" | "mis") => defineExtensionRoute({
  path: `/${from}/rewriteNavigations`,
  method: "POST" as const,
  query: ScowExtensionRouteContext,
  body: z.object({
    navs: z.array(NavItem) as z.ZodType<NavItem[]>,
  }),
  responses: {
    200: z.object({
      navs: z.array(NavItem) as z.ZodType<NavItem[]>,
    }),
  },
});


export const fromNavItemProps = (props: NavItemProps[]): NavItem[] => {
  return props.map((x) => ({
    path: x.path,
    clickToPath: x.clickToPath,
    text: x.text,
    openInNewPage: x.openInNewPage,
    children: x.children ? fromNavItemProps(x.children) : undefined,
  }));
};

/**
 * 将Extension API返回的导航栏转换为用于渲染的导航栏
 * @param originalItems 传给Extension API的原始导航栏
 * @param returnedItems Extension API返回的导航栏
 * @param extensionName Extension名称，用于计算新的路径
 * @returns 用于渲染的导航栏
 */
export const toNavItemProps = (
  originalItems: NavItemProps[],
  returnedItems: NavItem[],
  extensionName?: string,
): NavItemProps[] => {

  // create a map with original origin items paths
  const originalItemsMap = new Map<string, NavItemProps>();

  const convertToMap = (navs: NavItemProps) => {
    originalItemsMap.set(navs.path, navs);
    navs.children?.forEach(convertToMap);
  };

  const convertPath = (returnedPath: string) => {
    // 如果这个路径是原始的导航栏中的一项，则路径不处理
    if (originalItemsMap.has(returnedPath)) { return returnedPath; }

    // 如果这个路径是一个正确的URL，则路径不处理

    if (isUrl(returnedPath)) { return returnedPath; }
    const parts = ["/extensions"];
    if (extensionName) { parts.push(extensionName); }
    parts.push(returnedPath);
    return join(...parts);
  };

  originalItems.forEach(convertToMap);

  const rec = (items: NavItem[]): NavItemProps[] => {
    return items.map((item) => ({
      path: convertPath(item.path),
      clickToPath: item.clickToPath ? convertPath(item.clickToPath) : undefined,
      text: item.text,
      openInNewPage: item.openInNewPage,
      Icon: (item.icon
        ? <NavIcon src={item.icon.src} alt={item.icon.alt} />
        : originalItemsMap.get(item.path)?.Icon
      ) ?? LinkOutlined,
      handleClick: originalItemsMap.get(item.path)?.handleClick,
      children: item.children ? rec(item.children) : undefined,
    }));
  };

  return rec(returnedItems);

};
