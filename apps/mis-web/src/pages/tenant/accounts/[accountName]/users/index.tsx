import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { App } from "antd";
import { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { BackIcon } from "@scow/lib-web/build/icons/commonIcons";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { UserTable } from "src/pageComponents/users/UserTable";
import { Head } from "src/utils/head";
import { TitleLinkContainer } from "@scow/lib-web/build/components/Title";

const p = prefix("page.tenant.accounts.accountName.users.index.");

export const AccountUsersPage: NextPage = requireAuth(
  (i) => i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(
  ({ userStore }) => {
    const t = useI18nTranslateToString();

    const { message } = App.useApp();

    const router = useRouter();

    const accountName = queryToString(router.query.accountName);

    const promiseFn = useCallback(async () => {
      if (!accountName) { return undefined; }
      return await api.getAccountUsers({
        query: {
          accountName,
        }
      })
        .httpError(403, () => {
          message.error(t(p("cannotManageUser"), [accountName]));
          return undefined;
        });
    }, [userStore.user]);

    const [refreshToken, update] = useRefreshToken();

    const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

    const title = t(p("userInAccount"), [accountName]);

    return (
      <div>
        <Head title={title} />
        <PageTitle
          beforeTitle={(
            <TitleLinkContainer>
              <Link href="/tenant/accounts/list" legacyBehavior>
                <BackIcon />
              </Link>
            </TitleLinkContainer>
          )}
          titleText={title}
        >
        </PageTitle>
        <UserTable
          canSetAdmin={true}
          reload={reload}
          update={update}
          accountName={accountName}
          data={data}
          isLoading={isLoading}
          getJobsPageUrl={(userId) => `/tenant/accounts/${accountName}/users/${userId}/jobs`}
        />
      </div>
    );
  });

export default AccountUsersPage;
