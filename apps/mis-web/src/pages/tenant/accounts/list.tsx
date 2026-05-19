import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { AccountTable } from "src/pageComponents/accounts/AccountTable";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.accounts.list.");

export const AdminAccountsPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(() => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const promiseFn = useCallback(async () => {
    return await api.getAccounts({});
  }, []);

  const [refreshToken, update] = useRefreshToken();

  const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

  return (
    <div>
      <Head title={t(p("title"))} />
      <PageTitle titleText={t(p("title"))}>
        <RefreshLink refresh={update} languageId={languageId} />
      </PageTitle>
      <AccountTable data={data} isLoading={isLoading} reload={reload} showedTab={"TENANT"} />
    </div>
  );
});

export default AdminAccountsPage;
