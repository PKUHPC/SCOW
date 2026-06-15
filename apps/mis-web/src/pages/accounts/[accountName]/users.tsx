import { useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { UserRole } from "src/models/User";
import { useAccountPagesAccountName } from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { UserTable } from "src/pageComponents/users/UserTable";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.users.");

export const UsersPage: NextPage = requireAuth((i) => i.accountAffiliations.some((x) => x.role !== UserRole.USER))(({
  userStore,
}) => {
  const accountName = useAccountPagesAccountName();
  const t = useI18nTranslateToString();

  const account = userStore.user.accountAffiliations.find((x) => x.accountName === accountName);
  // 如果因为管理员自己取消了自己的管理权限或者在账户下移出了自己
  // 当前账户已不在登录用户的账户关联关系下，或者权限已不是主管理员或管理员
  // 则返回错误页面
  if (!account || account.role === UserRole.USER) {
    return <NotFoundPage />;
  }

  const promiseFn = useCallback(async () => {
    return await api.getAccountUsers({
      query: {
        accountName,
      },
    });
  }, [accountName]);

  const [refreshToken, update] = useRefreshToken();

  const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

  const title = t(p("title"), [accountName]);

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title}></PageTitle>
      <UserTable
        data={data}
        isLoading={isLoading}
        reload={reload}
        update={update}
        accountName={accountName}
        canSetAdmin={account.role === UserRole.OWNER}
        getJobsPageUrl={(userId) => ({
          pathname: `/accounts/${accountName}/userJobs`,
          query: { userId },
        })}
      />
    </div>
  );
});

export default UsersPage;
