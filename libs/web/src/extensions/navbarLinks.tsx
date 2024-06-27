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

import { ScowExtensionRouteContext } from "src/extensions/common";
import { defineExtensionRoute } from "src/extensions/routes";
import { z } from "zod";

export const NavbarLink = z.object({
  href: z.string({ description: "链接的目标路径，将会被直接填入<a>标签的href" }),
  text: z.string(),
  icon: z.optional(z.object({
    src: z.string(),
    alt: z.string().optional(),
  })),
  openInNewPage: z.boolean().default(true),
  priority: z.number().default(0),
});

export type NavbarLink = z.infer<typeof NavbarLink>;

export const navbarLinksRoute = (from: "portal" | "mis") => defineExtensionRoute({
  path: `/${from}/navbarLinks`,
  method: "POST" as const,
  query: ScowExtensionRouteContext,
  responses: {
    200: z.object({
      navbarLinks: z.optional(z.array(NavbarLink)),
    }),
  },
});

