import { useMemo } from "react";
import { useStore } from "simstate";
import { ShellCard } from "src/pageComponents/loginCluster/ShellCard";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";

const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
  gap: 24px;
`;

interface Cluster {
  id: string;
  name: string;
  description?: string;
}

interface ShellCardListProps {
  clusters: Cluster[];
}

export const ShellCardList: React.FC<ShellCardListProps> = ({ clusters }) => {
  const { loginNodes } = useStore(LoginNodeStore);

  const shellData = useMemo(() => {
    if (!publicConfig.ENABLE_SHELL) {
      return [];
    }

    return clusters.flatMap((cluster) => {
      const clusterNodes = loginNodes[cluster.id];

      // 检查该集群是否有登录节点，并且公有配置启用了 Shell
      if (clusterNodes && clusterNodes.length > 0) {
        // 如果有登录节点，则扁平化生成 Shell 卡片
        return clusterNodes.map((loginNode) => ({
          id: `${cluster.id}-${loginNode.name}`,
          description: cluster.description!,
          clusterName: cluster.name,
          clusterId: cluster.id,
          nodeAddress: loginNode.address,
          nodeName: loginNode.name,
        }));
      }

      return [];
    });
  }, [clusters, loginNodes]);

  return (
    <CardContainer>
      {shellData.map((item) => (
        <ShellCard key={item.id} data={item} />
      ))}
    </CardContainer>
  );
};
