import { Button, Result } from "antd";
import Link from "next/link";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export const NotAuthorizedPage = () => {
  const t = useI18nTranslateToString();
  const p = prefix("layout.error.notAuthorizedPage.");

  useDocumentTitle(t(p("needLogin")));

  return (
    <>
      <Result
        status="403"
        title={t(p("needLogin"))}
        subTitle={t(p("subTitle"))}
        extra={
          <Link href={"/api/auth"}>
            <Button type="primary">{t(p("login"))}</Button>
          </Link>
        }
      />
    </>
  );
};
