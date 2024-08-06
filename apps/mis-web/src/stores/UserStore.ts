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

import { useCallback, useState } from "react";
import { api } from "src/apis";
import { destroyUserInfoCookie } from "src/auth/cookie";
import { AccountAffiliation, PlatformRole, TenantRole, UserState } from "src/models/User";

export interface User {
  tenant: string;
  identityId: string;
  name?: string;
  token: string;
  tenantRoles: TenantRole[];
  platformRoles: PlatformRole[];
  accountAffiliations: AccountAffiliation[];
  email?: string;
  createTime?: string;
  state: UserState;
}

export function UserStore(initialUser: User | undefined = undefined) {
  const [user, setUser] = useState<User | undefined>(initialUser);

  const loggedIn = !!user;

  const logout = useCallback(() => {
    api.logout({}).catch((e) => { console.log("Error when logout", e); })
      .finally(() => {
        setUser(undefined);
        destroyUserInfoCookie(null);
      });
  }, []);

  return { loggedIn, user, logout };
}
