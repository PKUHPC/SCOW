import { FormLayout } from "@scow/lib-web/build/layouts/FormLayout";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { TenantChargeForm } from "src/pageComponents/admin/TenantChargeForm";
import { Head } from "src/utils/head";

const p = prefix("page.admin.finance.pay.");

export const TenantFinancePayPage: NextPage = requireAuth(
  (i) =>
    i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) || i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("tenantCharge"))} />
      <PageTitle titleText={t(p("tenantCharge"))} />
      <FormLayout>
        <TenantChargeForm />
      </FormLayout>
    </div>
  );
});

export default TenantFinancePayPage;
