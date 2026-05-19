import { Result } from "antd";
import { useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

export const ClusterNotAvailablePage = () => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t("component.errorPages.notExist")} />
      <Result status="404" title={"404"} subTitle={t("component.errorPages.clusterNotAvailable")} />
    </>
  );
};
