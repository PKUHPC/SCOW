import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { RunningJobQueryTable } from "src/pageComponents/job/RunningJobTable";
import { Head } from "src/utils/head";

export const RunningJobsPage: NextPage = requireAuth(() => true)(({ userStore }) => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("pages.jobs.runningJobs.title")} />
      <PageTitle titleText={t("pages.jobs.runningJobs.title")} />
      <RunningJobQueryTable userId={userStore.user.identityId} />
    </div>
  );
});

export default RunningJobsPage;
