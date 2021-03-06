import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { AppSessionsTable } from "src/pageComponents/app/AppSessionsTable";
import { Head } from "src/utils/head";

export const SessionsIndexPage: NextPage = requireAuth(() => true)(() => {

  return (
    <div>
      <Head title="交互式应用" />
      <PageTitle titleText="交互式应用" />
      <AppSessionsTable />
    </div>
  );
});


export default SessionsIndexPage;
