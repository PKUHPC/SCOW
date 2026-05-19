import type { UserInfo } from "src/models/User";

import React from "react";
import { useStore } from "simstate";
import { ForbiddenPage } from "src/components/errorPages/ForbiddenPage";
import { Redirect } from "src/components/Redirect";
import { User, UserStore } from "src/stores/UserStore";

type UserStoreType = ReturnType<typeof UserStore>;

export interface RequireAuthProps {
  userStore: UserStoreType & { user: User };
}

export type Check = (info: UserInfo) => boolean;

export const requireAuth =
  (check: Check, extraCheck?: (user: User) => JSX.Element | undefined) =>
  <CP extends {}>(Component: React.ComponentType<RequireAuthProps & CP>) =>
  (cp) => {
    const userStore = useStore(UserStore);

    if (!userStore.user) {
      return <Redirect url="/api/auth" />;
    }

    if (!check(userStore.user)) {
      return <ForbiddenPage />;
    }

    if (extraCheck) {
      const node = extraCheck(userStore.user);
      if (node) {
        return node;
      }
    }

    return <Component userStore={userStore} {...cp} />;
  };
