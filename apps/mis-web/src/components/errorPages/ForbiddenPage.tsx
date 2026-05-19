import { Result } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

interface Props {
  title?: "notAllowedPage";
  subTitle?: "systemNotAllowed";
}
const p = prefix("component.errorPages.");

export const ForbiddenPage: React.FC<Props> = ({ title = "notAllowedPage", subTitle = "systemNotAllowed" }) => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t(p("notAllowed"))} />
      <Result status="403" title={t(p(title))} subTitle={t(p(subTitle))} />
    </>
  );
};
