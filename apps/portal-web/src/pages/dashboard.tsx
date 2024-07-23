/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { PartitionInfo } from "@scow/protos/build/portal/config";
import { NodeInfo } from "@scow/protos/build/portal/config";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { useI18nTranslateToString } from "src/i18n";
import { ClusterOverview, PlatformOverview } from "src/models/cluster";
import { OverviewTable } from "src/pageComponents/dashboard/OverviewTable";
import { QuickEntry } from "src/pageComponents/dashboard/QuickEntry";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

interface Props {}

interface FulfilledResult {
  clusterInfo: { clusterName: string; partitions: PartitionInfo[] };
}

interface FulfilledNodesResult {
  nodeInfo: { clusterName: string; nodes: NodeInfo[] };
}

export const DashboardPage: NextPage<Props> = requireAuth(() => true)(() => {
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

      const rawClusterInfoResults = await Promise.allSettled(rawClusterInfoPromises);

      const rawClusterNodesInfoPromises = currentClusters.map((x) =>
        api
          .getClusterNodesInfo({ query: { cluster: x.id } })
          .httpError(500, () => {}),
      );

      const rawClusterNodesInfoResults = await Promise.allSettled(rawClusterNodesInfoPromises);

      const successfulNodesResults = rawClusterNodesInfoResults
        .map((result, idx) => {
          if (result.status === "fulfilled") {
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

      console.log(successfulNodesResults);

      const successfulResults = rawClusterInfoResults
        .map((result, idx) => {
          if (result.status === "fulfilled") {
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

      console.log(nodeCountsByPartition);

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

        const aggregatedData = partitions.reduce(
          (acc, partition) => {
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
            acc.partitionStatus += partition.partitionStatus;

            // 去除重复节点的统计
            Object.keys(nodeCountsByPartition).forEach((nodeName) => {
              const nodeCountInPartitions = nodeCountsByPartition[nodeName];
              if (nodeCountInPartitions[partition.partitionName]) {
                const duplicateCount = nodeCountInPartitions[partition.partitionName] - 1;
                acc.nodeCount -= duplicateCount;
                acc.runningNodeCount -= partition.runningNodeCount ? duplicateCount : 0;
                acc.idleNodeCount -= partition.idleNodeCount ? duplicateCount : 0;
                acc.notAvailableNodeCount -= partition.notAvailableNodeCount ? duplicateCount : 0;
                acc.cpuCoreCount -= duplicateCount * partition.cpuCoreCount;
                acc.runningCpuCount -= duplicateCount * partition.runningCpuCount;
                acc.idleCpuCount -= duplicateCount * partition.idleCpuCount;
                acc.notAvailableCpuCount -= duplicateCount *
                (partition.cpuCoreCount - partition.runningCpuCount - partition.idleCpuCount);
                acc.gpuCoreCount -= duplicateCount * partition.gpuCoreCount;
                acc.runningGpuCount -= duplicateCount * partition.runningGpuCount;
                acc.idleGpuCount -= duplicateCount * partition.idleGpuCount;
                acc.notAvailableGpuCount -= duplicateCount *
                 (partition.gpuCoreCount - partition.runningGpuCount - partition.idleGpuCount);
              }
            });

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
      <QuickEntry
        currentClusters={currentClusters}
        publicConfigClusters={publicConfigClusters}
      />
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

const DashboardPageContent = styled.div``;

export default DashboardPage;
