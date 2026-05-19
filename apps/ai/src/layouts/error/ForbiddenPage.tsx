"use client";

import { Result } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

interface Props {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
}

export const ForbiddenPage: React.FC<Props> = ({ title, subTitle }) => {
  const t = useI18nTranslateToString();
  const p = prefix("layout.error.forbiddenPage.");

  useDocumentTitle(t(p("forbidden")));
  return (
    <>
      <Result status="403" title={title ?? t(p("title"))} subTitle={subTitle ?? t(p("subTitle"))} />
    </>
  );
};
