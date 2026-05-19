import { Button, Result } from "antd";
import Link from "next/link";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Head } from "src/utils/head";

const p = prefix("component.errorPages.");

export const NotAuthorizedPage = () => {
  const t = useI18nTranslateToString();

  return (
    <>
      <Head title={t(p("needLogin"))} />
      <Result
        status="403"
        title={t(p("needLogin"))}
        subTitle={t(p("notLogin"))}
        extra={
          <Link href={"/api/auth"}>
            <Button type="primary">{t(p("login"))}</Button>
          </Link>
        }
      />
    </>
  );
};
