import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { AllJobQueryTable } from "src/pageComponents/job/AllJobsTable";
import { Head } from "src/utils/head";

export const AllJobsPage: NextPage = requireAuth(() => true)(({ userStore }) => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("pages.jobs.allJobs.title")} />
      <PageTitle titleText={t("pages.jobs.allJobs.title")} />
      <AllJobQueryTable userId={userStore.user.identityId} />
    </div>
  );
});

export default AllJobsPage;
