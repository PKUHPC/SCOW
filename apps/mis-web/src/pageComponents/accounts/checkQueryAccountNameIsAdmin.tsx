import type { User } from "src/stores/UserStore";

import { queryToString, useQuerystring } from "@scow/lib-web/build/utils/querystring";
import { ForbiddenPage } from "src/components/errorPages/ForbiddenPage";
import { AccountState, UserRole } from "src/models/User";

export const checkQueryAccountNameIsAdmin = (u: User) => {
  const query = useQuerystring();
  const accountName = queryToString(query.accountName);

  const account = u.accountAffiliations.find((x) => x.accountName === accountName);
  if (!account || account.role === UserRole.USER || account.accountState === AccountState.DELETED) {
    return <ForbiddenPage />;
  }
};

export const useAccountPagesAccountName = () => {
  const query = useQuerystring();
  const accountName = queryToString(query.accountName);

  return accountName;
};
