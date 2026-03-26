import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { AppSessionsTable } from "src/pageComponents/app/AppSessionsTable";
import { Head } from "src/utils/head";

export const SessionsIndexPage: NextPage = requireAuth(() => true)(() => {

  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("pages.apps.sessions.title")} />
      <PageTitle
        titleText={t("pages.apps.sessions.pageTitle")}
      />
      <AppSessionsTable />
    </div>
  );
});


export default SessionsIndexPage;
