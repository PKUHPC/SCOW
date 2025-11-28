"use client";

import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

import { DatasetListTable } from "../DatasetListTable";

export default function Page() {
  const t = useI18nTranslateToString();

  const { publicConfig, currentAssociateClusterIds } = usePublicConfig();

  useDocumentTitle(t("app.dataset.private"));

  return (
    <div>
      <PageTitle titleText={t("app.dataset.private")} />
      <DatasetListTable
        isPublic={false}
        clusters={publicConfig.CLUSTERS}
        currentClusterIds={currentAssociateClusterIds}
      />
    </div>
  );
}
