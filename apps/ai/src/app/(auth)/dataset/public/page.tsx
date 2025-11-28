"use client";

import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

import { usePublicConfig } from "../../context";
import { DatasetListTable } from "../DatasetListTable";

export default function Page() {
  const t = useI18nTranslateToString();

  const { publicConfig, currentAssociateClusterIds } = usePublicConfig();

  useDocumentTitle(t("app.dataset.public"));

  return (
    <div>
      <PageTitle titleText={t("app.dataset.public")} />
      <DatasetListTable
        isPublic={true}
        clusters={publicConfig.CLUSTERS}
        currentClusterIds={currentAssociateClusterIds}
      />
    </div>
  );
}
