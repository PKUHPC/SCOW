"use client";

import { Footer } from "@scow/lib-web/build/layouts/base/Footer";
import { PartitionInfo } from "@scow/protos/build/portal/config";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useUiConfig } from "src/app/uiContext";
import { ClusterOverview, PlatformOverview } from "src/models/Cluster";
import { Head } from "src/utils/head";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { OverviewTable } from "./OverviewTable";

const DashboardPageContent = styled.div``;

interface ClusterPartitionInfo extends PartitionInfo {
  clusterId: string;
  cpuUsage: string;
  gpuUsage?: string;
}

const initialPlatformOverview: PlatformOverview = {
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

export default function Page() {
  const { publicConfig: { CLUSTERS: currentClusters, VERSION_TAG: versionTag } } = usePublicConfig();

  // 使用批量接口获取所有集群信息
  const clusterIds = currentClusters.map((cluster) => cluster.id);

  const allClustersInfoResult = trpc.dashboard.getAllClustersInfo.useQuery(
    { clusterIds },
    { enabled: clusterIds.length > 0 },
  );

  const allClustersNodesResult = trpc.dashboard.getAllClustersNodesInfo.useQuery(
    { clusterIds },
    { enabled: clusterIds.length > 0 },
  );

  // 获取用户关联账户的集群分区信息
  const userAssociatedClusterPartitions = trpc.resource.getUserAssociatedClusterPartitions.useQuery();

  // 加载失败的集群、成功的集群、集群信息、平台概览、以及集群概览。
  const [failedClusters, setFailedClusters] = useState<typeof currentClusters>([]);
  const [successfulClusters, setSuccessfulClusters] = useState<typeof currentClusters>([]);
  const [clustersInfo, setClustersInfo] = useState<ClusterPartitionInfo[]>([]);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview>({ ...initialPlatformOverview });
  const [clustersOverview, setClustersOverview] = useState<ClusterOverview[]>([]);

  const isLoading = allClustersInfoResult.isLoading ||
    allClustersNodesResult.isLoading || userAssociatedClusterPartitions.isLoading;

  const { hostname, uiConfig } = useUiConfig();
  const footerConfig = uiConfig.config.footer;
  const footerText = (hostname && footerConfig?.hostnameMap?.[hostname])
    ?? footerConfig?.defaultText;

  useEffect(() => {
    if (!isLoading && allClustersInfoResult.data && allClustersNodesResult.data) {
      // 集群信息
      const rawClusterInfoResults = allClustersInfoResult.data.clusters
        .map((cluster) => {
          // 如果已配置资源管理系统，只返回已授权集群及队列的clusterInfo
          if (userAssociatedClusterPartitions?.data?.clusterPartitions !== undefined) {
            const associatedClusterPartitions = userAssociatedClusterPartitions.data.clusterPartitions;

            // 如果当前集群存在于已授权集群信息
            if (Object.keys(associatedClusterPartitions).includes(cluster.clusterId)) {
              const assignedPartitions = cluster.partitions.filter((partition) => {
                return associatedClusterPartitions[cluster.clusterId].includes(partition.partitionName);
              });
              return {
                partitions: assignedPartitions,
                clusterId: cluster.clusterId,
              };
            } else {
              // 如果当前集群不在已授权集群信息中
              return null;
            }
          }

          return {
            partitions: cluster.partitions,
            clusterId: cluster.clusterId,
          };
        })
        .filter((cluster) => cluster !== null);

      // 集群内的节点信息
      const rawClusterNodesInfoResults = allClustersNodesResult.data.clusters
        .map((cluster) => {
          let nodes = cluster.nodeInfo || [];

          // 如果已配置资源管理系统，只返回已授权集群及队列的clusterNodesInfo
          if (userAssociatedClusterPartitions?.data?.clusterPartitions !== undefined) {
            const associatedClusterPartitions = userAssociatedClusterPartitions.data.clusterPartitions;

            // 如果当前集群存在于已授权集群信息
            if (Object.keys(associatedClusterPartitions).includes(cluster.clusterId)) {
              // 返回包含已过滤分区的节点信息
              // 如果一个分区也没有则不再返回对应节点信息
              nodes = nodes.filter((node) => {
                return node.partitions.some((partition: string) =>
                  associatedClusterPartitions[cluster.clusterId].includes(partition),
                );
              });
            } else {
              // 如果当前集群不在已授权集群信息中
              return null;
            }
          }

          return {
            nodeInfo: {
              clusterId: cluster.clusterId,
              nodes,
            },
          };
        })
        .filter((node) => node !== null);

      const successfulClusterIds = new Set(
        allClustersInfoResult.data.clusters.map((c) => c.clusterId),
      );

      const successfulClusters = currentClusters.filter((cluster) =>
        successfulClusterIds.has(cluster.id),
      );

      const failedClusters = currentClusters.filter(
        (cluster) => !successfulClusterIds.has(cluster.id),
      );

      setFailedClusters(failedClusters);
      setSuccessfulClusters(successfulClusters);

      // 统计分区节点信息;记录每个节点在各个队列的计数。
      const nodeCountsByPartition: Record<string, Record<string, number>> = {};

      for (const { nodeInfo } of rawClusterNodesInfoResults) {
        for (const node of nodeInfo.nodes) {
          if (!nodeCountsByPartition[node.nodeName]) {
            nodeCountsByPartition[node.nodeName] = {};
          }
          for (const partition of node.partitions) {
            nodeCountsByPartition[node.nodeName][partition] =
              (nodeCountsByPartition[node.nodeName][partition] || 0) + 1;
          }
        }
      }

      // 存储各集群各队列分区的详细信息
      const clustersInfo = rawClusterInfoResults
        .flatMap((cluster) =>
          cluster.partitions.map((partition) => ({
            clusterId: cluster.clusterId,
            ...partition,
            cpuUsage: ((partition.runningCpuCount / partition.cpuCoreCount) * 100).toFixed(2),
            gpuUsage: partition.gpuCoreCount
              ? ((partition.runningGpuCount / partition.gpuCoreCount) * 100).toFixed(2)
              : undefined,
          })),
        );

      // 整合各集群的各分区信息，计算集群概览的聚合数据,
      const clustersOverview: ClusterOverview[] = [];
      rawClusterInfoResults.forEach((result) => {
        // 各集群
        const { clusterId, partitions } = result;
        const aggregatedData = partitions.reduce(
          (acc, partition) => {
            acc.partitionName = partition.partitionName;
            acc.nodeCount += partition.nodeCount;
            acc.runningNodeCount += partition.runningNodeCount;
            acc.idleNodeCount += partition.idleNodeCount;
            acc.notAvailableNodeCount += partition.notAvailableNodeCount;
            acc.cpuCoreCount += partition.cpuCoreCount;
            acc.runningCpuCount += partition.runningCpuCount;
            acc.idleCpuCount += partition.idleCpuCount;
            acc.notAvailableCpuCount += partition.notAvailableCpuCount;
            acc.gpuCoreCount += partition.gpuCoreCount;
            acc.runningGpuCount += partition.runningGpuCount;
            acc.idleGpuCount += partition.idleGpuCount;
            acc.notAvailableGpuCount += partition.notAvailableGpuCount;
            acc.jobCount += partition.jobCount;
            acc.runningJobCount += partition.runningJobCount;
            acc.pendingJobCount += partition.pendingJobCount;
            return acc;
          },
          {
            clusterId,
            partitionName: "",
            ...initialPlatformOverview,
          },
        );


        // 处理节点实际数据，调整聚合数据 真实节点数据列表
        const realNode = rawClusterNodesInfoResults.
          find((v) => v.nodeInfo.clusterId === clusterId)?.nodeInfo.nodes;

        // 修正聚合数据中的节点计数和 CPU/GPU 数据
        if (realNode) {
          aggregatedData.runningNodeCount = realNode.filter((v) => v.state === 2).length; // 正在运行
          aggregatedData.notAvailableNodeCount = realNode.filter((v) => v.state === 3).length; // 不可用
          aggregatedData.idleNodeCount = realNode.filter((v) => v.state === 1).length; // 空闲节点
          // 重置CPU GPU的计数
          aggregatedData.cpuCoreCount = 0;
          aggregatedData.runningCpuCount = 0;
          aggregatedData.idleCpuCount = 0;
          aggregatedData.gpuCoreCount = 0;
          aggregatedData.runningGpuCount = 0;
          aggregatedData.idleGpuCount = 0;
          // 重新计算CPU GPU的计数
          for (const node of realNode) {
            aggregatedData.cpuCoreCount += node.cpuCoreCount;
            aggregatedData.idleCpuCount += node.idleCpuCoreCount;
            aggregatedData.runningCpuCount += node.allocCpuCoreCount;
            aggregatedData.gpuCoreCount += node.gpuCount;
            aggregatedData.idleGpuCount += node.idleGpuCount;
            aggregatedData.runningGpuCount += node.allocGpuCount;
          }
        }

        // 更新平台概览 platformOverview 的数值
        platformOverview.nodeCount += aggregatedData.nodeCount;
        platformOverview.runningNodeCount += aggregatedData.runningNodeCount;
        platformOverview.idleNodeCount += aggregatedData.idleNodeCount;
        platformOverview.notAvailableNodeCount += aggregatedData.notAvailableNodeCount;
        platformOverview.cpuCoreCount += aggregatedData.cpuCoreCount;
        platformOverview.runningCpuCount += aggregatedData.runningCpuCount;
        platformOverview.idleCpuCount += aggregatedData.idleCpuCount;
        platformOverview.notAvailableCpuCount += aggregatedData.notAvailableCpuCount;
        platformOverview.gpuCoreCount += aggregatedData.gpuCoreCount;
        platformOverview.runningGpuCount += aggregatedData.runningGpuCount;
        platformOverview.idleGpuCount += aggregatedData.idleGpuCount;
        platformOverview.notAvailableGpuCount += aggregatedData.notAvailableGpuCount;
        platformOverview.jobCount += aggregatedData.jobCount;
        platformOverview.runningJobCount += aggregatedData.runningJobCount;
        platformOverview.pendingJobCount += aggregatedData.pendingJobCount;
        platformOverview.partitionStatus += aggregatedData.partitionStatus;

        aggregatedData.usageRatePercentage = Number(
          ((aggregatedData.runningNodeCount / aggregatedData.nodeCount) * 100).toFixed(2),
        );


        clustersOverview.push(aggregatedData);
      });

      platformOverview.usageRatePercentage = Number(
        ((platformOverview.runningNodeCount / platformOverview.nodeCount) * 100).toFixed(2),
      );

      setFailedClusters(failedClusters);
      setSuccessfulClusters(successfulClusters);
      setClustersInfo(clustersInfo);
      setPlatformOverview(platformOverview);
      setClustersOverview(clustersOverview);

    }

  }, [
    isLoading, currentClusters, allClustersInfoResult.data,
    allClustersNodesResult.data, userAssociatedClusterPartitions.data,
  ]);

  const filteredClusters = useMemo(() => {
    if (!isLoading) {
      if (userAssociatedClusterPartitions?.data?.clusterPartitions === undefined) {
        return currentClusters;
      }

      const clusterPartitions = userAssociatedClusterPartitions?.data?.clusterPartitions;

      return currentClusters.filter((c) =>
        Object.keys(clusterPartitions || {}).includes(c.id),
      );
    }
    return [];
  }, [
    isLoading,
    userAssociatedClusterPartitions,
    currentClusters,
  ]);

  return (
    <DashboardPageContent>
      <Head title={"dashboard"} />
      <OverviewTable
        isLoading={isLoading}
        clusterInfo={clustersInfo ? clustersInfo.map((item) => ({ ...item })) : []}
        failedClusters={failedClusters}
        currentClusters={filteredClusters}
        clustersOverview={clustersOverview ?? []}
        platformOverview={platformOverview}
        successfulClusters={successfulClusters}
      />
      <Footer text={footerText} versionTag={versionTag} />
    </DashboardPageContent>
  );
}
