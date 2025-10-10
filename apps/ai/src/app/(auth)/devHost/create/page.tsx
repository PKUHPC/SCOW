"use client";

import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";

import { CreateDevHostForm } from "../CreateDevHostForm";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.devHost.createPage.");

  return (
    <div>
      <PageTitle titleText={t(p("title"))} />
      <CreateDevHostForm />
    </div>
  );
}
