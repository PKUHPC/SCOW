import { Typography } from "antd";
import { join } from "path";
import { useI18nTranslateToString } from "src/i18n";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

const TypographyLink = styled(Typography.Link)`
  font-size: 18px !important;
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  align-items: center;
`;

export default function Home() {
  const t = useI18nTranslateToString();

  // 1. 获取公共配置数据
  const publicConfigQuery = trpc.config.publicConfig.useQuery();

  // 2. 获取Quantum配置数据
  const quantumConfigQuery = trpc.jobs.getQuantumConfig.useQuery();

  // 3. 处理加载状态
  if (publicConfigQuery.isLoading || quantumConfigQuery.isLoading) {
    return (
      <div>Loading...</div>
    );
  }

  // 4. 处理错误状态
  if (publicConfigQuery.isError || !publicConfigQuery.isSuccess) {
    return (
      <div>Error loading user or configuration.</div>
    );
  }

  if (quantumConfigQuery.isError || !quantumConfigQuery.isSuccess) {
    return (
      <div>Error loading quantum configuration.</div>
    );
  }

  // 5. 构建动态URL
  const portalUrl = publicConfigQuery.data.portalUrl;

  const { cluster, appId } = quantumConfigQuery.data;

  const appCreateUrl = `apps/${cluster}/create/${appId}`;

  return (
    <TypographyLink
      href={join(portalUrl, appCreateUrl)}
      disabled={!cluster || !appId}
      target="_blank"
    >
      {t("page.jupyter.create")} jupyter
    </TypographyLink>
  );
}
