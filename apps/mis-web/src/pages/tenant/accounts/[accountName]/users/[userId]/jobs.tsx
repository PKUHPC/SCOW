import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { requireAuth } from "src/auth/requireAuth";
import { BackButton } from "src/components/BackButton";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { JobTable } from "src/pageComponents/job/HistoryJobTable";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.accounts.accountName.users.userId.jobs.");

export const JobsPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(() => {
  const t = useI18nTranslateToString();

  const router = useRouter();

  const userId = queryToString(router.query.userId);
  const accountName = queryToString(router.query.accountName);

  const title = t(p("userExecJobList"), [userId, accountName]);

  return (
    <div>
      <Head title={title} />
      <PageTitle beforeTitle={<BackButton href={`/admin/accounts/${accountName}/users`} />} titleText={title} />
      <JobTable
        userId={userId}
        accountNames={accountName}
        filterUser={false}
        showAccount={false}
        showUser={false}
        showedPrices={["account", "tenant"]}
      />
    </div>
  );
});

export default JobsPage;
