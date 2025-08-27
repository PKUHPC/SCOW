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

export interface User {
  identityId: string;
  name?: string;
  token: string;
  isAdmin: boolean; // 是否为管理员(租户或平台管理员)
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
