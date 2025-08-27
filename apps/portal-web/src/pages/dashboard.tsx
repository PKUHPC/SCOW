import { DisplayModeContext } from "@scow/lib-web/build/layouts/DisplayModeContext";
import { Col, Row } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo } from "react";
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

const createEmptyOverview = (): PlatformOverview => ({
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
});

const NotificationCol = styled(Col)`
padding-bottom: 16px;

/* 默认隐藏消息部分 */
display: none;

/* 在屏幕宽度达到 1200px 时显示消息部分 */
@media (min-width: 1200px) {
  display: block;
}
`;

const DashboardPageContent = styled.div``;

export const DashboardPage: NextPage = requireAuth(() => true)(() => {
  const userStore = useStore(UserStore);
  const router = useRouter();

  useEffect(() => {
    router.replace(router.asPath);
  }, [userStore.user]);

  const t = useI18nTranslateToString();

  const { publicConfigClusters, currentClusters } = useStore(ClusterInfoStore);

  // 判断是否显示全部资源
  const { user } = useStore(UserStore);

  const isFullDisplayMode = useMemo(() => {
    return user?.isAdmin || publicConfig.DASHBOARD_USER_DISPLAY_MODE === "full";
  }, [user]);

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      // 检查 currentClusters 是否为空
      if (!currentClusters || currentClusters.length === 0) {
        return {
          clustersInfo: [],
          failedClusters: [],
          clustersOverview: [],
          platformOverview: createEmptyOverview(),
          successfulClusters: [],
        };
      }

      const clusterIds = currentClusters.map((cluster) => cluster.id);

      // 并行获取集群信息和节点信息
      const [clusterInfoResponse, nodeInfoResponse, userPartitions] = await Promise.all([
        api.getAllClustersInfo({ query: { clusterIds, isFullDisplayMode } }).httpError(500, () => []),
        api.getAllClusterNodesInfo({ query: { clusterIds } }).httpError(500, () => ({ results: []})),
        api.getUserAssociatedClusterPartitions({}),
      ]);

      const clusterInfoResults = clusterInfoResponse.results;
      const nodeInfoResults = nodeInfoResponse.results;

      // 权限过滤函数
      const filterByPermissions = <T extends { clusterId: string }>(
        items: T[],
        filterFn: (item: T, assignedPartitions: string[]) => T | null,
      ) => {
        if (!userPartitions?.clusterPartitions) {
          return items;
        }

        return items
          .map((item) => {
            const assignedPartitions = userPartitions.clusterPartitions[item.clusterId];
            if (!assignedPartitions) return null;
            return filterFn(item, assignedPartitions);
          })
          .filter((item): item is T => item !== null);
      };

      // 过滤节点信息
      const filteredNodeResults = filterByPermissions(
        nodeInfoResults.map((info) => ({
          clusterId: info.clusterId,
          nodes: info.nodeInfo,
        })),
        (item, assignedPartitions) => ({
          clusterId: item.clusterId,
          nodes: item.nodes
            .map((node) => {
              const filteredPartitions = node.partitions.filter((partition) =>
                assignedPartitions.includes(partition),
              );
              return filteredPartitions.length > 0
                ? { ...node, partitions: filteredPartitions }
                : null;
            })
            .filter((node): node is NonNullable<typeof node> => node !== null),
        }),
      );

      // 过滤集群信息
      const filteredClusterResults = filterByPermissions(
        clusterInfoResults.map((result) => ({
          clusterId: result.clusterInfo.clusterId,
          partitions: result.clusterInfo.partitions.map((partition) => ({
            ...partition,
            notAvailableNodeCount: partition.notAvailableNodeCount ?? 0,
            notAvailableCpuCount: partition.notAvailableCpuCount ?? 0,
            notAvailableGpuCount: partition.notAvailableGpuCount ?? 0,
          })),
        })),
        (item, assignedPartitions) => ({
          clusterId: item.clusterId,
          partitions: item.partitions.filter((partition) =>
            assignedPartitions.includes(partition.partitionName),
          ),
        }),
      );

      const successfulClusterNames = new Set(filteredClusterResults.map((result) => result.clusterId));
      const failedClusters = currentClusters.filter((cluster) => !successfulClusterNames.has(cluster.id));
      const successfulClusters = currentClusters.filter((cluster) => successfulClusterNames.has(cluster.id));

      // 统计节点分区数量（如果需要的话，当前代码中未使用此变量）
      const nodePartitionCounts: Record<string, Record<string, number>> = {};
      filteredNodeResults.forEach(({ nodes }) => {
        nodes.forEach((node) => {
          node.partitions.forEach((partition) => {
            nodePartitionCounts[node.nodeName] ??= {};
            nodePartitionCounts[node.nodeName][partition] =
              (nodePartitionCounts[node.nodeName][partition] ?? 0) + 1;
          });
        });
      });

      // 构建集群分区信息，包含使用率计算
      const clustersInfo = filteredClusterResults.flatMap((cluster) =>
        cluster.partitions.map((partition) => ({
          clusterId: cluster.clusterId,
          ...partition,
          cpuUsage: partition.cpuCoreCount > 0 ?
            ((partition.runningCpuCount / partition.cpuCoreCount) * 100).toFixed(2) : "0",
          gpuUsage: partition.gpuCoreCount > 0 ?
            ((partition.runningGpuCount / partition.gpuCoreCount) * 100).toFixed(2) : "0",
        })),
      );

      const platformOverview: PlatformOverview = createEmptyOverview();

      // 构建集群概览数据
      const clustersOverview: ClusterOverview[] = filteredClusterResults.map((cluster) => {
        const { clusterId, partitions } = cluster;

        // 初始化集群数据
        const clusterData: ClusterOverview = {
          clusterId,
          partitionName: "",
          ...createEmptyOverview(),
        };

        // 累加分区的作业信息
        partitions.forEach((partition) => {
          clusterData.jobCount += partition.jobCount;
          clusterData.runningJobCount += partition.runningJobCount;
          clusterData.pendingJobCount += partition.pendingJobCount;
        });

        // 从节点信息中获取真实的节点和资源数据
        const clusterNodes = filteredNodeResults.find(
          (nodeResult) => nodeResult.clusterId === clusterId,
        )?.nodes || [];

        clusterNodes.forEach((node) => {
          // 累加CPU和GPU资源
          clusterData.cpuCoreCount += node.cpuCoreCount;
          clusterData.runningCpuCount += node.allocCpuCoreCount;
          clusterData.idleCpuCount += node.idleCpuCoreCount;
          clusterData.gpuCoreCount += node.gpuCount;
          clusterData.runningGpuCount += node.allocGpuCount;
          clusterData.idleGpuCount += node.idleGpuCount;

          // 统计节点状态（1: idle, 2: running, 3: not available）
          if (node.state === 1) clusterData.idleNodeCount++;
          else if (node.state === 2) clusterData.runningNodeCount++;
          else if (node.state === 3) clusterData.notAvailableNodeCount++;
        });

        // 计算总节点数和不可用资源数
        clusterData.nodeCount = clusterData.runningNodeCount +
          clusterData.idleNodeCount + clusterData.notAvailableNodeCount;
        clusterData.notAvailableCpuCount = clusterData.cpuCoreCount -
          clusterData.runningCpuCount - clusterData.idleCpuCount;
        clusterData.notAvailableGpuCount = clusterData.gpuCoreCount -
          clusterData.runningGpuCount - clusterData.idleGpuCount;

        // 计算使用率
        clusterData.usageRatePercentage = clusterData.nodeCount > 0
          ? Number(((clusterData.runningNodeCount / clusterData.nodeCount) * 100).toFixed(2))
          : 0;

        return clusterData;
      });

      // 累加平台总览数据
      clustersOverview.forEach((cluster) => {
        platformOverview.nodeCount += cluster.nodeCount;
        platformOverview.runningNodeCount += cluster.runningNodeCount;
        platformOverview.idleNodeCount += cluster.idleNodeCount;
        platformOverview.notAvailableNodeCount += cluster.notAvailableNodeCount;
        platformOverview.jobCount += cluster.jobCount;
        platformOverview.runningJobCount += cluster.runningJobCount;
        platformOverview.pendingJobCount += cluster.pendingJobCount;
        platformOverview.cpuCoreCount += cluster.cpuCoreCount;
        platformOverview.runningCpuCount += cluster.runningCpuCount;
        platformOverview.idleCpuCount += cluster.idleCpuCount;
        platformOverview.notAvailableCpuCount += cluster.notAvailableCpuCount;
        platformOverview.gpuCoreCount += cluster.gpuCoreCount;
        platformOverview.runningGpuCount += cluster.runningGpuCount;
        platformOverview.idleGpuCount += cluster.idleGpuCount;
        platformOverview.notAvailableGpuCount += cluster.notAvailableGpuCount;
      });

      // 计算平台使用率
      platformOverview.usageRatePercentage = platformOverview.nodeCount > 0
        ? Number(((platformOverview.runningNodeCount / platformOverview.nodeCount) * 100).toFixed(2))
        : 0;

      return {
        clustersInfo,
        failedClusters,
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
          <NotificationCol xl={7}>
            <NotificationCard />
          </NotificationCol>
        )}
      </Row>
      <DisplayModeContext.Provider value={isFullDisplayMode}>
        <OverviewTable
          isLoading={isLoading}
          clusterInfo={data?.clustersInfo ? data.clustersInfo.map((item, idx) => ({ ...item, id: idx })) : []}
          failedClusters={data?.failedClusters ?? []}
          currentClusters={currentClusters}
          clustersOverview={data?.clustersOverview ?? []}
          platformOverview={data?.platformOverview}
          successfulClusters={data?.successfulClusters}
        />
      </DisplayModeContext.Provider>
    </DashboardPageContent>
  );
});

export default DashboardPage;
