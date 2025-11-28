"use client";
import { usePublicConfig } from "src/app/(auth)/context";
import { ModalTable } from "src/app/(auth)/model/ModelTable";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.");

  useDocumentTitle(t(p("private")));

  const { publicConfig } = usePublicConfig();

  return (
    <div>
      <PageTitle titleText={t(p("private"))} />
      <ModalTable isPublic={false} clusters={publicConfig.CLUSTERS} />
    </div>
  );
}
