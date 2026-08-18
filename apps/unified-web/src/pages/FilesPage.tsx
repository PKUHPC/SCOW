import { Card, Typography } from "antd";
import { useTranslation } from "react-i18next";

const { Paragraph, Title } = Typography;

export function FilesPage() {
  const { t } = useTranslation("common");

  return (
    <Card>
      <Title level={2}>{t("files.title", "文件管理")}</Title>
      <Paragraph type="secondary">
        {t("files.description", "此页面将以 Portal 文件管理为基础，统一管理用户可访问的 HPC 与 AI 集群文件。")}
      </Paragraph>
    </Card>
  );
}
