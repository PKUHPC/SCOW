import { Result } from "antd";
import React from "react";
import { useI18nTranslate, useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

interface Props {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
}

export const ForbiddenPage: React.FC<Props> = () => {
  const tArgs = useI18nTranslate();
  const t = useI18nTranslateToString();

  const titleText = tArgs("component.errorPages.notAllowedPage");
  const subTitleText = tArgs("component.errorPages.systemNotAllowed");

  return (
    <>
      <Head title={t("component.errorPages.notAllowed")} />
      <Result status="403" title={titleText} subTitle={subTitleText} />
    </>
  );
};
