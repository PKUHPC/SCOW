"use client";
import { AlgorithmTable } from "src/app/(auth)/algorithm/AlgorithmTable";
import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export default function Page() {

  const { publicConfig } = usePublicConfig();
  const t = useI18nTranslateToString();

  useDocumentTitle(t("app.algorithm.private"));

  return (
    <>
      <PageTitle titleText={t("app.algorithm.private")} />
      <AlgorithmTable isPublic={false} clusters={publicConfig.CLUSTERS} />
    </>
  );
}
