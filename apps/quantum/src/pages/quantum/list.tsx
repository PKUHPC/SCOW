import { NextPage } from "next";
import { Head } from "src/components/head";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { JobsTable } from "src/pageComponents/quantum/JobsTable";

export const QuantumJobsPage: NextPage = () => {

  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("route.quantum.list")} />
      <PageTitle titleText={t("route.quantum.list")} />
      <JobsTable />
    </div>
  );

};

export default QuantumJobsPage;
