import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { PaymentTable, SearchType } from "src/pageComponents/common/PaymentTable";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.finance.payments.");

export const PaymentsPage: NextPage = requireAuth(
  (i) => i.tenantRoles.includes(TenantRole.TENANT_FINANCE) || i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("title"))} />
      <PageTitle titleText={t(p("title"))} />
      <PaymentTable searchType={SearchType.selfTenant} />
    </div>
  );
});

export default PaymentsPage;
