import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { PlatformRole, SearchType } from "src/models/User";
import { ChargeTable } from "src/pageComponents/finance/ChargeTable";
import { Head } from "src/utils/head";

export const PlatformAccountsChargesPage: NextPage = requireAuth(
  (u) =>
    u.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) || u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  const title = t("page.admin.finance.accountChargeRecords.title");

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title}></PageTitle>
      <ChargeTable
        showAccountName={true}
        showTenantName={true}
        isPlatformRecords={true}
        searchType={SearchType.ACCOUNT}
      />
    </div>
  );
});

export default PlatformAccountsChargesPage;
