import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { Divider, Space } from "antd";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { AccountWhitelistTable } from "src/pageComponents/tenant/AccountWhitelistTable";
import { AddWhitelistedAccountButton } from "src/pageComponents/tenant/AddWhitelistedAccountButton";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.accounts.whitelist.");

export const AccountWhitelistPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(
  () => {
    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;

    const promiseFn = useCallback(async () => {
      return await api.getWhitelistedAccounts({});
    }, []);

    const [refreshToken, update] = useRefreshToken();

    const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

    return (
      <div>
        <Head title={t(p("title"))} />
        <PageTitle titleText={t(p("whitelistAccountList"))}>
          <Space split={<Divider type="vertical" />}>
            <AddWhitelistedAccountButton refresh={reload} />
            <RefreshLink refresh={update} languageId={languageId} />
          </Space>
        </PageTitle>
        <AccountWhitelistTable data={data} isLoading={isLoading} reload={reload} />
      </div>
    );
  },
);

export default AccountWhitelistPage;
