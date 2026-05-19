import { Result } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

const p = prefix("component.errorPages.");

export const ServerErrorPage: React.FC = () => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t(p("serverWrong"))} />
      <Result status="500" title="500" subTitle={t(p("sorry"))} />
    </>
  );
};
