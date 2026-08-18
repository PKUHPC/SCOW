import { Result } from "antd";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  const { t } = useTranslation("common");

  return (
    <Result
      status="404"
      title={t("notFound.title", "页面不存在")}
      extra={<Link to="/">{t("notFound.backHome", "返回首页")}</Link>}
    />
  );
}
