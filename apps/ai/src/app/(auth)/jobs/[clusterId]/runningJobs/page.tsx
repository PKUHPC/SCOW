"use client"; ;
import { use } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { NotFoundPage } from "src/layouts/error/NotFoundPage";
import { useDocumentTitle } from "src/utils/head";

import { AppSessionsTable, AppTableStatus } from "../AppSessionsTable";

export default function Page(props: { params: Promise<{ clusterId: string }> }) {
  const params = use(props.params);
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.unfinishedJobs.");

  const { clusterId } = params;

  const { publicConfig } = usePublicConfig();
  const cluster = publicConfig.CLUSTERS.find((x) => x.id === clusterId);

  useDocumentTitle(t(p("title")));

  if (!cluster) {
    return <NotFoundPage />;
  }


  return (
    <>
      <PageTitle
        titleText={t(p("title"))}
      />
      <AppSessionsTable cluster={cluster} status={AppTableStatus.UNFINISHED} />
    </>
  );
}
