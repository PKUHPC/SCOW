import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { RunningJobQueryTable } from "src/pageComponents/job/RunningJobTable";
import { Head } from "src/utils/head";

export const RunningJobsPage: NextPage = requireAuth((u) => u.accountAffiliations.length > 0)(({ userStore }) => {
  const t = useI18nTranslateToString();
  return (
    <div>
      <Head title={t("runningJob.title")} />
      <PageTitle titleText={t("runningJob.title")} />
      <RunningJobQueryTable
        userId={userStore.user.identityId}
        accountNames={userStore.user.accountAffiliations.map((x) => x.accountName)}
        showAccount={true}
        showUser={false}
        showOwner={true}
      />
    </div>
  );
});

export default RunningJobsPage;
