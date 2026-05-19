import { Button, Result } from "antd";
import Link from "next/link";
import { useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

export const NotAuthorizedPage = () => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t("component.errorPages.needLogin")} />
      <Result
        status="403"
        title={t("component.errorPages.needLogin")}
        subTitle={t("component.errorPages.notLogin")}
        extra={
          <Link href={"/api/auth"}>
            <Button type="primary">{t("component.errorPages.login")}</Button>
          </Link>
        }
      />
    </>
  );
};
