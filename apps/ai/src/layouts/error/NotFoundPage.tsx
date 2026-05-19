"use client";

import { Result } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export const NotFoundPage = () => {
  const t = useI18nTranslateToString();
  const p = prefix("layout.error.notFoundPage.");

  useDocumentTitle(t(p("notFound")));
  return (
    <>
      <Result status="404" title={"404"} subTitle={t(p("notFoundPage"))} />
    </>
  );
};
