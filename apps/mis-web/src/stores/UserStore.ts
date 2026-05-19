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
  phone?: string;
  organization?: string;
  createTime?: string;
  state: UserState;
}

export function UserStore(initialUser: User | undefined = undefined) {
  const [user, setUser] = useState<User | undefined>(initialUser);

  const loggedIn = !!user;

  const logout = useCallback(() => {
    api
      .logout({})
      .catch((e) => {
        console.log("Error when logout", e);
      })
      .finally(() => {
        setUser(undefined);
        destroyUserInfoCookie(null);
      });
  }, []);

  return { loggedIn, user, logout, setUser };
}
