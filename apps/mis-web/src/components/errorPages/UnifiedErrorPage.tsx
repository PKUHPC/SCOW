import React, { useEffect } from "react";
import { useStore } from "simstate";
import { UserStore } from "src/stores/UserStore";

import { ForbiddenPage } from "./ForbiddenPage";
import { NotAuthorizedPage } from "./NotAuthorizedPage";
import { NotFoundPage } from "./NotFoundPage";
import { ServerErrorPage } from "./ServerErrorPage";

interface Props {
  code: number;
  customComponents?: Record<number, React.ReactElement>;
}

export const UnifiedErrorPage: React.FC<Props> = ({ code, customComponents = {} }) => {
  const userStore = useStore(UserStore);

  useEffect(() => {
    if (code === 401) {
      userStore.logout();
    }
  }, []);

  switch (code) {
    case 401:
      return customComponents[401] ?? <NotAuthorizedPage />;
    case 403:
      return customComponents[403] ?? <ForbiddenPage />;
    case 404:
      return customComponents[404] ?? <NotFoundPage />;
    default:
      return customComponents[code] ?? <ServerErrorPage />;
  }
};
