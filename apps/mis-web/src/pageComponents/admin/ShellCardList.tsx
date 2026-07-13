import type { ClusterConfigSchema } from "@scow/config/build/cluster";

import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import React from "react";
import { useStore } from "simstate";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { useI18n } from "src/i18n";
import { ShellCard } from "src/pageComponents/admin/ShellCard";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";

interface ClusterInfo {
  id: string;
  config: ClusterConfigSchema;
  shellBaseUrl: string;
  shellType: "portal" | "ai";
}

type LoginNodeConfig = ClusterConfigSchema["loginNodes"][number];

const getLoginNodeInfo = (loginNodeConfig: LoginNodeConfig) => {
  return typeof loginNodeConfig === "string"
    ? { name: loginNodeConfig, address: loginNodeConfig }
    : { name: loginNodeConfig.name, address: loginNodeConfig.address };
};

const Container = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(390px, 1fr));
  gap: 24px;
  width: 100%;
`;

export const ShellCardList: React.FC = () => {
  const { activatedClusters, fullClusterConfigs } = useStore(ClusterInfoStore);

  // 1. 从 fullClusterConfigs 中取出所有集群（对象 -> 数组）
  const allClusters = Object.entries(fullClusterConfigs || {});

  // 2. 生成启用组。HPC 和 AI 同时启用时优先打开 portal shell。
  const activeClusters: ClusterInfo[] = [];

  for (const [id, config] of allClusters) {
    const shellTarget =
      config.hpc?.enabled && publicConfig.PORTAL_URL
        ? { shellBaseUrl: publicConfig.PORTAL_URL, shellType: "portal" as const }
        : config.ai?.enabled && publicConfig.AI_URL
          ? { shellBaseUrl: publicConfig.AI_URL, shellType: "ai" as const }
          : undefined;

    if (shellTarget && activatedClusters?.[id]) {
      activeClusters.push({ id, config, ...shellTarget });
    }
  }

  // 3. 没有启用集群时，显示错误页
  if (activeClusters.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  // 4. 生成 ShellCardData
  const languageId = useI18n().currentLanguage.id;

  const shellCards = activeClusters.flatMap(({ id, config, shellBaseUrl, shellType }) => {
    const loginNodes = config.loginNodes;
    if (loginNodes.length === 0) {
      return [];
    }

    return loginNodes.map((loginNodeConfig) => {
      const node = getLoginNodeInfo(loginNodeConfig);
      return {
        id: `${shellBaseUrl}-${id}-${node.name}`,
        clusterId: id,
        clusterName: getI18nConfigCurrentText(config.displayName, languageId) || id,
        nodeAddress: node.address,
        nodeName: getI18nConfigCurrentText(node.name, languageId),
        description: getI18nConfigCurrentText(config.description, languageId),
        shellBaseUrl,
        shellType,
      };
    });
  });

  // 当前不展示对应系统未启用、未配置 URL 以及停用的集群
  return (
    <Container>
      {shellCards.map((card) => (
        <ShellCard key={card.id} data={card} />
      ))}
    </Container>
  );
};

export default ShellCardList;
