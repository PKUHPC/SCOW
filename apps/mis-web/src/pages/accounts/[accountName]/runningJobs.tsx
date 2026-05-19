import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslate, useI18nTranslateToString } from "src/i18n";
import {
  checkQueryAccountNameIsAdmin,
  useAccountPagesAccountName,
} from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { RunningJobQueryTable } from "src/pageComponents/job/RunningJobTable";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.runningJobs.");

export const RunningJobsPage: NextPage = requireAuth(
  (u) => u.accountAffiliations.length > 0,
  checkQueryAccountNameIsAdmin,
)(() => {
  const t = useI18nTranslateToString();
  const tArgs = useI18nTranslate();

  const accountName = useAccountPagesAccountName();
  const title = t(p("title"), [accountName]);
  const pageTitle = tArgs(p("title"), [accountName]);

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={pageTitle} />
      <RunningJobQueryTable accountNames={accountName} showAccount={false} filterAccountName={false} showUser={true} />
    </div>
  );
});

export default RunningJobsPage;
