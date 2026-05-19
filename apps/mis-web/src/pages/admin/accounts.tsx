import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { AccountTable } from "src/pageComponents/accounts/AccountTable";
import { Head } from "src/utils/head";

export const AccountListPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;

    const promiseFn = useCallback(async () => {
      return await api.getAllAccounts({});
    }, []);

    const [refreshToken, update] = useRefreshToken();

    const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

    return (
      <div>
        <Head title={t("common.accountList")} />
        <PageTitle titleText={t("common.accountList")}>
          <RefreshLink refresh={update} languageId={languageId} />
        </PageTitle>
        <AccountTable data={data} isLoading={isLoading} reload={reload} showedTab={"PLATFORM"} />
      </div>
    );
  },
);

export default AccountListPage;
