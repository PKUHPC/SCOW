import { Result } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

const p = prefix("component.errorPages.");

export const NotFoundPage = () => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t(p("notExist"))} />
      <Result status="404" title={"404"} subTitle={t(p("pageNotExist"))} />
    </>
  );
};
