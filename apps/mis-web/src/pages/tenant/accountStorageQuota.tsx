import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { TenantAccountStorageManagerTable } from "src/pageComponents/storage/TenantAccountStorageManagerTable";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.accountStorageQuota.");

export const AccountStorageQuotaPage: NextPage = requireAuth(
  (u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("pageTitle"))} />
      <PageTitle titleText={t(p("pageTitle"))} />
      <TenantAccountStorageManagerTable />
    </div>
  );
});

export default AccountStorageQuotaPage;
