import { NextPage } from "next";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { AppSessionsTable } from "src/pageComponents/jupyter/AppSessionsTable";
import { Head } from "src/utils/head";

export const JupyterJobsPage: NextPage = () => {

  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("route.jupyter.list")} />
      <PageTitle
        titleText={t("route.jupyter.list")}
      />
      <AppSessionsTable />
    </div>
  );

};

export default JupyterJobsPage;
