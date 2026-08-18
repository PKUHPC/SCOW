import { Card, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import type { ModuleDefinition, ModuleRouteDefinition } from "src/shared/module";

const { Paragraph, Title } = Typography;

function Placeholder({ module, pageTitle }: { module: ModuleDefinition; pageTitle: ModuleRouteDefinition["title"] }) {
  const { t } = useTranslation(["common", "portal", "ai", "notification", "quantum"]);

  return (
    <Card>
      <Space direction="vertical" size="small">
        <Title level={2}>{pageTitle(t)}</Title>
        <Paragraph type="secondary">
          {t("module.placeholder", "{{module}} 已接入统一路由，领域页面将在后续迁移步骤中替换此占位内容。", {
            module: module.title(t),
          })}
        </Paragraph>
      </Space>
    </Card>
  );
}

export function ModuleLandingPage({ module }: { module: ModuleDefinition }) {
  return (
    <Routes>
      <Route index element={<Navigate replace to={module.children[0].path} />} />
      {module.children.map((route) => (
        <Route
          key={route.path}
          path={`${route.path}/*`}
          element={<Placeholder module={module} pageTitle={route.title} />}
        />
      ))}
    </Routes>
  );
}
