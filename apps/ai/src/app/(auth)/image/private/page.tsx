"use client";

import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

import { usePublicConfig } from "../../context";
import { ImageListTable } from "../ImageListTable";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.");

  const { publicConfig, currentAssociateClusterIds } = usePublicConfig();

  useDocumentTitle(t(p("private")));

  return (
    <div>
      <PageTitle titleText={t(p("private"))} />
      <ImageListTable
        isPublic={false}
        clusters={publicConfig.CLUSTERS}
        currentClusterIds={currentAssociateClusterIds}
      />
    </div>
  );
}
