import { Result } from "antd";
import { NextPage } from "next";
import { useI18nTranslateToString } from "src/i18n";

export const NoAccountPage: NextPage = () => {
  const t = useI18nTranslateToString();

  return (
    <Result
      status="warning"
      title={t("page.noAccount.resultTitle")}
      subTitle=""
      extra={<p>{t("page.noAccount.extraMessage")}</p>}
    />
  );
};

export default NoAccountPage;
