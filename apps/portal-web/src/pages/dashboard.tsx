import { getHostname } from "@scow/lib-web/build/utils/getHostname";
import { PartitionInfo } from "@scow/protos/build/portal/config";
import { NodeInfo } from "@scow/protos/build/portal/config";
import { Col, Row } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { useI18nTranslateToString } from "src/i18n";
import { ClusterOverview, PlatformOverview } from "src/models/cluster";
import { NotificationCard } from "src/pageComponents/dashboard/NotificationCard";
import { OverviewTable } from "src/pageComponents/dashboard/OverviewTable";
import { QuickEntry } from "src/pageComponents/dashboard/QuickEntry";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const StyleCol = styled(Col)`
padding-bottom: 16px;

/* 默认隐藏消息部分 */
display: none;

/* 在屏幕宽度达到 1200px 时显示消息部分 */
@media (min-width: 1200px) {
  display: block;
}
`;

const DashboardPageContent = styled.div``;

interface Props {
  hostname?: string;
}

interface FulfilledResult {
  clusterInfo: { clusterName: string; partitions: PartitionInfo[] };
}

interface FulfilledNodesResult {
  nodeInfo: { clusterName: string; nodes: NodeInfo[] };
}

export const DashboardPage: NextPage<Props> = requireAuth(() => true)((props: Props) => {
  const userStore = useStore(UserStore);
  const router = useRouter();

  useEffect(() => {
    router.replace(router.asPath);
  }, [userStore.user]);

  const t = useI18nTranslateToString();

  const { publicConfigClusters, currentClusters } = useStore(ClusterInfoStore);

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      const rawClusterInfoPromises = currentClusters.map((x) =>
        api
          .getClusterRunningInfo({ query: { clusterId: x.id } })
          .httpError(500, () => {}),
      );

      const rawClusterNodesInfoPromises = currentClusters.map((x) =>
        api
          .getClusterNodesInfo({ query: { cluster: x.id } })
          .httpError(500, () => {}),
      );

      // 并行处理两个Promise，不互相等待
      const [rawClusterInfoResults, rawClusterNodesInfoResults] = await Promise.all([
        Promise.allSettled(rawClusterInfoPromises),
        Promise.allSettled(rawClusterNodesInfoPromises),
      ]);

      const rawAssignedClusterPartitions = await api.getUserAssociatedClusterPartitions({});

      const successfulNodesResults = rawClusterNodesInfoResults
        .map((result, idx) => {
          if (result.status === "fulfilled") {

            // 如果已配置资源管理扩展功能，则只显示关联账户已被授权的集群和分区
            if (rawAssignedClusterPartitions?.clusterPartitions) {
              // 判断当前集群是否为已授权集群
              const isClusterAssigned =
                Object.keys(rawAssignedClusterPartitions.clusterPartitions).includes(currentClusters[idx].id);
              if (isClusterAssigned) {
                // 只返回已经授权的分区
                const assignedPartitions = rawAssignedClusterPartitions.clusterPartitions[currentClusters[idx].id];
                return {
                  ...result,
                  value: {
                    nodeInfo: {
                      clusterName: currentClusters[idx].id,
                      nodes: result.value.nodeInfo.map((node) => {
                        const filteredNodePartitions = node.partitions
                          .filter((partition) => (assignedPartitions.includes(partition)));
                        // 返回包含已过滤分区的节点信息
                        // 如果一个分区也没有则不再返回对应节点信息
                        return filteredNodePartitions.length > 0
                          ? {
                            ...node,
                            partitions: filteredNodePartitions,
                          }
                          : null;
                      }).filter((node) => (node !== null)),
                    },
                  },
                } as PromiseSettledResult<FulfilledNodesResult>;

              }
            }

            return {
              ...result,
              value: {
                nodeInfo: {
                  clusterName: currentClusters[idx].id,
                  nodes: result.value.nodeInfo,
                },
              },
            } as PromiseSettledResult<FulfilledNodesResult>;
          }

          return result;
        })
        .filter(
          (result): result is PromiseFulfilledResult<FulfilledNodesResult> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);

      const successfulResults = rawClusterInfoResults
        .map((result, idx) => {
          if (result.status === "fulfilled") {

            // 如果已配置资源管理扩展功能，则只显示关联账户已被授权的集群和分区
            if (rawAssignedClusterPartitions?.clusterPartitions) {
              // 判断当前集群是否为已授权集群
              const isClusterAssigned =
                Object.keys(rawAssignedClusterPartitions.clusterPartitions).includes(currentClusters[idx].id);
              if (isClusterAssigned) {
                // 只返回已经授权的分区
                const assignedPartitions = rawAssignedClusterPartitions.clusterPartitions[currentClusters[idx].id];
                const filteredPartitions = result.value.clusterInfo.partitions
                  .filter((partition) => (assignedPartitions.includes(partition.partitionName)));
                return {
                  ...result,
                  value: {
                    clusterInfo: {
                      clusterName: currentClusters[idx].id,
                      partitions: filteredPartitions,
                    },
                  },
                } as PromiseSettledResult<FulfilledResult>;

              }
            }

            return {
              ...result,
              value: {
                clusterInfo: {
                  clusterName: currentClusters[idx].id,
                  partitions: result.value.clusterInfo.partitions,
                },
              },
            } as PromiseSettledResult<FulfilledResult>;
          }

          return result;
        })
        .filter(
          (result): result is PromiseFulfilledResult<FulfilledResult> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);

      const failedClusters = currentClusters.filter(
        (x) => !successfulResults.find((y) => y.clusterInfo.clusterName === x.id),
      );

      const successfulClusters = currentClusters.filter((x) =>
        successfulResults.find((y) => y.clusterInfo.clusterName === x.id),
      );

      const nodeCountsByPartition: Record<string, Record<string, number>> = {};
      successfulNodesResults.forEach(({ nodeInfo }) => {
        nodeInfo.nodes.forEach((node) => {
          node.partitions.forEach((partition) => {
            if (!nodeCountsByPartition[node.nodeName]) {
              nodeCountsByPartition[node.nodeName] = {};
            }
            if (!nodeCountsByPartition[node.nodeName][partition]) {
              nodeCountsByPartition[node.nodeName][partition] = 0;
            }
            nodeCountsByPartition[node.nodeName][partition]++;
          });
        });
      });

      const clustersInfo = successfulResults
        .map((cluster) => ({
          clusterInfo: {
            ...cluster.clusterInfo,
            clusterName: cluster.clusterInfo.clusterName,
          },
        }))
        .flatMap((cluster) =>
          cluster.clusterInfo.partitions.map((x) => ({
            clusterName: cluster.clusterInfo.clusterName,
            ...x,
            cpuUsage: ((x.runningCpuCount / x.cpuCoreCount) * 100).toFixed(2),
            gpuUsage: x.gpuCoreCount
              ? ((x.runningGpuCount / x.gpuCoreCount) * 100).toFixed(2)
              : undefined,
          })),
        );

      const platformOverview: PlatformOverview = {
        nodeCount: 0,
        runningNodeCount: 0,
        idleNodeCount: 0,
        notAvailableNodeCount: 0,
        cpuCoreCount: 0,
        runningCpuCount: 0,
        idleCpuCount: 0,
        notAvailableCpuCount: 0,
        gpuCoreCount: 0,
        runningGpuCount: 0,
        idleGpuCount: 0,
        notAvailableGpuCount: 0,
        jobCount: 0,
        runningJobCount: 0,
        pendingJobCount: 0,
        usageRatePercentage: 0,
        partitionStatus: 0,
      };

      const clustersOverview: ClusterOverview[] = [];
      successfulResults.forEach((result) => {

        const { clusterName, partitions } = result.clusterInfo;

        // 先累加分区的资源信息
        const aggregatedData = partitions.reduce(
          (acc, partition) => {
            acc.nodeCount += partition.nodeCount;
            acc.runningNodeCount += partition.runningNodeCount;
            acc.idleNodeCount += partition.idleNodeCount;
            acc.notAvailableNodeCount += partition.notAvailableNodeCount;
            acc.jobCount += partition.jobCount;
            acc.runningJobCount += partition.runningJobCount;
            acc.pendingJobCount += partition.pendingJobCount;

            return acc;
          },
          {
            clusterName,
            nodeCount: 0,
            runningNodeCount: 0,
            idleNodeCount: 0,
            notAvailableNodeCount: 0,
            cpuCoreCount: 0,
            runningCpuCount: 0,
            idleCpuCount: 0,
            notAvailableCpuCount: 0,
            gpuCoreCount: 0,
            runningGpuCount: 0,
            idleGpuCount: 0,
            notAvailableGpuCount: 0,
            jobCount: 0,
            runningJobCount: 0,
            pendingJobCount: 0,
            usageRatePercentage: 0,
            partitionStatus: 0,
          },
        );

        // 通过 successfulNodesResults 来更新 CPU 和 GPU 相关的数据
        successfulNodesResults.forEach((nodeResult) => {
          if (nodeResult.nodeInfo.clusterName === aggregatedData.clusterName) {
            nodeResult.nodeInfo.nodes.forEach((node) => {
              aggregatedData.cpuCoreCount += node.cpuCoreCount;
              aggregatedData.runningCpuCount += node.allocCpuCoreCount;
              aggregatedData.idleCpuCount += node.idleCpuCoreCount;
              aggregatedData.gpuCoreCount += node.gpuCount;
              aggregatedData.runningGpuCount += node.allocGpuCount;
              aggregatedData.idleGpuCount += node.idleGpuCount;
            });
          }
        });

        // 计算 `notAvailableCpuCount` 和 `notAvailableGpuCount`
        aggregatedData.notAvailableCpuCount = aggregatedData.cpuCoreCount -
        aggregatedData.idleCpuCount - aggregatedData.runningCpuCount;
        aggregatedData.notAvailableGpuCount = aggregatedData.gpuCoreCount -
         aggregatedData.idleGpuCount - aggregatedData.runningGpuCount;

        // 计算真实节点数
        const realNode = successfulNodesResults.
          find((v) => v.nodeInfo.clusterName === clusterName)?.nodeInfo.nodes;

        if (realNode) {
          aggregatedData.runningNodeCount = realNode.filter((v) => v.state === 2).length;
          aggregatedData.notAvailableNodeCount = realNode.filter((v) => v.state === 3).length;
          aggregatedData.idleNodeCount = realNode.filter((v) => v.state === 1).length;
          aggregatedData.nodeCount = aggregatedData.runningNodeCount +
           aggregatedData.notAvailableNodeCount +
            aggregatedData.idleNodeCount;
        }

        // 累加平台节点数
        platformOverview.nodeCount += aggregatedData.nodeCount;
        platformOverview.runningNodeCount += aggregatedData.runningNodeCount;
        platformOverview.idleNodeCount += aggregatedData.idleNodeCount;
        platformOverview.notAvailableNodeCount += aggregatedData.notAvailableNodeCount;
        platformOverview.jobCount += aggregatedData.jobCount;
        platformOverview.runningJobCount += aggregatedData.runningJobCount;
        platformOverview.pendingJobCount += aggregatedData.pendingJobCount;
        platformOverview.partitionStatus += aggregatedData.partitionStatus;
        // 累加 CPU 核心数据
        platformOverview.cpuCoreCount += aggregatedData.cpuCoreCount;
        platformOverview.runningCpuCount += aggregatedData.runningCpuCount;
        platformOverview.idleCpuCount += aggregatedData.idleCpuCount;
        platformOverview.notAvailableCpuCount +=
                    (aggregatedData.cpuCoreCount - aggregatedData.runningCpuCount - aggregatedData.idleCpuCount);
        // 累加 GPU 核心数据
        platformOverview.gpuCoreCount += aggregatedData.gpuCoreCount;
        platformOverview.runningGpuCount += aggregatedData.runningGpuCount;
        platformOverview.idleGpuCount += aggregatedData.idleGpuCount;
        platformOverview.notAvailableGpuCount += (aggregatedData.gpuCoreCount -
          aggregatedData.runningGpuCount - aggregatedData.idleGpuCount);

        aggregatedData.usageRatePercentage = Number(
          ((aggregatedData.runningNodeCount / aggregatedData.nodeCount) * 100).toFixed(2),
        );

        clustersOverview.push(aggregatedData);
      });

      platformOverview.usageRatePercentage = Number(
        ((platformOverview.runningNodeCount / platformOverview.nodeCount) * 100).toFixed(2),
      );

      return {
        clustersInfo,
        failedClusters: failedClusters.map((x) => ({ clusterName: x.name })),
        clustersOverview,
        platformOverview,
        successfulClusters,
      };
    }, [currentClusters]),
  });

  return (
    <DashboardPageContent>
      <Head title={t("pages.dashboard.title")} />
      <Row gutter={[16, 16]} wrap={true}>
        <Col sm={24} xl={publicConfig.NOTIF_ENABLED ? 17 : 24}>
          <QuickEntry
            currentClusters={currentClusters}
            publicConfigClusters={publicConfigClusters}
          />
        </Col>
        {publicConfig.NOTIF_ENABLED && (
          <StyleCol xl={7}>
            <NotificationCard></NotificationCard>
          </StyleCol>
        )}
      </Row>
      <OverviewTable
        isLoading={isLoading}
        clusterInfo={data?.clustersInfo ? data.clustersInfo.map((item, idx) => ({ ...item, id: idx })) : []}
        failedClusters={data?.failedClusters ?? []}
        currentClusters={currentClusters}
        clustersOverview={data?.clustersOverview ?? []}
        platformOverview={data?.platformOverview}
        successfulClusters={data?.successfulClusters}
      />
    </DashboardPageContent>
  );
});

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  return {
    props: {
      hostname: getHostname(req),
    },
  };
};

export default DashboardPage;
