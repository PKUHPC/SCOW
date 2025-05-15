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

import fp from "fastify-plugin";
import { AuthProvider } from "src/auth/AuthProvider";
import { createLdapAuthProvider } from "src/auth/ldap";
import { createSshAuthProvider } from "src/auth/ssh";
import { authConfig } from "src/config/auth";
import { config } from "src/config/env";

declare module "fastify" {
  interface FastifyInstance {
    auth: AuthProvider;
  }
}

const providers = {
  "ldap": createLdapAuthProvider,
  "ssh": createSshAuthProvider,
} as const;

export const authPlugin = fp(async (f) => {

  const authType = config.AUTH_TYPE || authConfig.authType;

  const provider = providers[authType];

  f.decorate("auth", await provider(f));
});
