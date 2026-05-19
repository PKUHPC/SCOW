import { FormLayout } from "@scow/lib-web/build/layouts/FormLayout";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { ChargeForm } from "src/pageComponents/finance/ChargeForm";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.finance.payAccount.");

export const FinancePayPage: NextPage = requireAuth(
  (i) => i.tenantRoles.includes(TenantRole.TENANT_FINANCE) || i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("title"))} />
      <PageTitle titleText={t(p("title"))} />
      <FormLayout>
        <ChargeForm />
      </FormLayout>
    </div>
  );
});

export default FinancePayPage;
