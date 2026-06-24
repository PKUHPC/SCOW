import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { BillTable } from "src/pageComponents/common/BillTable";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.finance.bills.");

export const BillPage: NextPage = requireAuth(
  (i) =>
    i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) || i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  const promiseFn = useCallback(async () => {
    return await api.getBillTypes({});
  }, []);

  const { data, isLoading } = useAsync({ promiseFn });

  return (
    <div>
      <Head title={t(p("title"))} />
      <PageTitle titleText={t(p("title"))} />
      <BillTable types={data?.types ?? []} loading={isLoading} />
    </div>
  );
});

export default BillPage;
