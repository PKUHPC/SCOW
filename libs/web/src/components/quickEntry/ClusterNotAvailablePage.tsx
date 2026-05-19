import { Result } from "antd";
import { Head } from "src/components/head";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";

export const ClusterNotAvailablePage = (languageId) => {
  return (
    <>
      <Head title={getCurrentLangLibWebText(languageId, "notExist") || ""} />
      <Result status="404" title={"404"} subTitle={getCurrentLangLibWebText(languageId, "clusterNotAvailable")} />
    </>
  );
};
