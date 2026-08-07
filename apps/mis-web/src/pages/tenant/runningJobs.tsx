import { NextPage } from "next";
import { useStore } from "simstate";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { RunningJobQueryTable } from "src/pageComponents/job/RunningJobTable";
import { UserStore } from "src/stores/UserStore";
import { Head } from "src/utils/head";

export const RunningJobsPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(() => {
  const t = useI18nTranslateToString();
  const userStore = useStore(UserStore);
  const tenantName = userStore.user?.tenant;

  return (
    <div>
      <Head title={t("common.unfinishedJob")} />
      <PageTitle titleText={t("common.unfinishedJob")} />
      <RunningJobQueryTable
        showUser={true}
        showAccount={true}
        showOwner={true}
        showChangeTimeLimit={true}
        accountNames={undefined}
        tenantName={tenantName}
      />
    </div>
  );
});

export default RunningJobsPage;
