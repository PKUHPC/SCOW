import { Result } from "antd";
import React from "react";
import { useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

export const ServerErrorPage: React.FC = () => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t("component.errorPages.serverWrong")} />
      <Result status="500" title="500" subTitle={t("component.errorPages.sorry")} />
    </>
  );
};
