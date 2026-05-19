import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { PaymentTable, SearchType } from "src/pageComponents/common/PaymentTable";
import { Head } from "src/utils/head";

const p = prefix("page.admin.finance.payments.");

export const TenantPaymentsPage: NextPage = requireAuth(
  (i) =>
    i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) || i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("chargeRecord"))} />
      <PageTitle titleText={t(p("chargeRecord"))} />
      <PaymentTable searchType={SearchType.tenant} />
    </div>
  );
});

export default TenantPaymentsPage;
