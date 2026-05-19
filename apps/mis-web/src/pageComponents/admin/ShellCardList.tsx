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
}

const Container = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(390px, 1fr));
  gap: 24px;
  width: 100%;
`;

export const ShellCardList: React.FC = () => {
  const { activatedClusters, fullClusterConfigs } = useStore(ClusterInfoStore);

  console.log("ClusterInfoStore", activatedClusters, fullClusterConfigs);

  // 1. 从 fullClusterConfigs 中取出所有集群（对象 -> 数组）
  const allClusters = Object.entries(fullClusterConfigs || {});

  // 2. 过滤掉 hpc 不可用的
  const hpcAvailableClusters = allClusters.filter(([_, config]) => config.hpc?.enabled);

  // 3. 拆分为启用组 / 停用组
  const activeClusters: ClusterInfo[] = [];
  const inactiveClusters: ClusterInfo[] = [];

  for (const [id, config] of hpcAvailableClusters) {
    if (activatedClusters?.[id]) {
      activeClusters.push({ id, config });
    } else {
      inactiveClusters.push({ id, config });
    }
  }

  // 4. 没有启用集群时，显示错误页
  if (activeClusters.length === 0 || publicConfig.PORTAL_URL === undefined) {
    return <ClusterNotAvailablePage />;
  }

  // 5. 生成 ShellCardData
  const languageId = useI18n().currentLanguage.id;

  const shellCards = activeClusters.flatMap(({ id, config }) => {
    const loginNodes = config.loginNodes;
    if (loginNodes.length === 0) {
      return [];
    }

    return loginNodes.map((node) => ({
      id: `${id}-${node.name}`,
      clusterId: id,
      clusterName: getI18nConfigCurrentText(config.displayName, languageId) || id,
      nodeAddress: node.address,
      nodeName: getI18nConfigCurrentText(node.name, languageId),
      description: getI18nConfigCurrentText(config.description, languageId),
    }));
  });

  // 当前不展示hpc为false以及停用的集群
  return (
    <Container>
      {shellCards.map((card) => (
        <ShellCard key={card.id} data={card} />
      ))}
    </Container>
  );
};

export default ShellCardList;
