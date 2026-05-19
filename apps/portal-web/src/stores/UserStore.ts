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

  return { loggedIn, user, logout };
}
