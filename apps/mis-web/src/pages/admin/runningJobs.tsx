import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { RunningJobQueryTable } from "src/pageComponents/job/RunningJobTable";
import { Head } from "src/utils/head";

export const AdminRunningJobsPage: NextPage = requireAuth((u) =>
  u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("common.unfinishedJob")} />
      <PageTitle titleText={t("common.unfinishedJob")} />
      <RunningJobQueryTable
        platform={true}
        showUser={true}
        showAccount={true}
        showOwner={true}
        showChangeTimeLimit={true}
        accountNames={undefined}
      />
    </div>
  );
});

export default AdminRunningJobsPage;
