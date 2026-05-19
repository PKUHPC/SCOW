import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { SearchType, TenantRole } from "src/models/User";
import { ChargeTable } from "src/pageComponents/finance/ChargeTable";
import { Head } from "src/utils/head";

export const TenantAccountsChargesPage: NextPage = requireAuth(
  (u) => u.tenantRoles.includes(TenantRole.TENANT_FINANCE) || u.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(() => {
  const t = useI18nTranslateToString();
  const title = t("page.tenant.finance.accountChargeRecords.title");

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title}></PageTitle>
      <ChargeTable showAccountName={true} showTenantName={false} searchType={SearchType.ACCOUNT} />
    </div>
  );
});

export default TenantAccountsChargesPage;
