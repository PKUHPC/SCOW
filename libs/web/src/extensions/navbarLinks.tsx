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

import { ExtensionRouteQuery } from "src/extensions/common";
import { defineExtensionRoute } from "src/extensions/routes";
import { z } from "zod";

export const NavbarLink = z.object({
  path: z.string({ description: "链接的目标路径。如果是一个完整的URL，将会直接作为a标签的href；如果不是，将会为UI扩展内部的路径。" }),
  text: z.string(),
  icon: z.optional(z.object({
    src: z.string(),
    alt: z.string().optional(),
  })),
  openInNewPage: z.boolean().default(true),
  priority: z.number().default(0),
  autoRefresh: z.optional(z.object({
    intervalMs: z.number(),
  })),
});

export type NavbarLink = z.infer<typeof NavbarLink>;

export const navbarLinksRoute = (from: "portal" | "mis" | "ai") => defineExtensionRoute({
  path: `/${from}/navbarLinks`,
  method: "POST" as const,
  query: ExtensionRouteQuery,
  responses: {
    200: z.object({
      navbarLinks: z.optional(z.array(NavbarLink)),
    }),
  },
});

