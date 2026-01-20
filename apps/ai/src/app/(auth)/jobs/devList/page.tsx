"use client";

import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

import { DevHostList } from "./DevHostList";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.listPage.");

  useDocumentTitle(t(p("title")));

  return (
    <div>
      <PageTitle titleText={t(p("title"))} />
      <DevHostList />
    </div>
  );
}
