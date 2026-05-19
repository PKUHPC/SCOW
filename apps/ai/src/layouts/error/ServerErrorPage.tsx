"use client";

import { Result } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export const ServerErrorPage: React.FC = () => {
  const t = useI18nTranslateToString();
  const p = prefix("layout.error.serverErrorPage.");

  useDocumentTitle(t(p("error")));
  return (
    <>
      <Result status="500" title="500" subTitle={t(p("sorry"))} />
    </>
  );
};
