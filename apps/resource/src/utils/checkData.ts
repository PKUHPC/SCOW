import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { ClusterPartition, ClusterWithName } from "src/server/trpc/route/mis-server/cluster";

// 判断对象是否为空
export function isEmptyObject(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}
// 获取分区获取失败的集群名列表
export function getMissingPartitionClusterNames(
  comparedClusterIds: string[],
  currentClustersPartitionsData: ClusterPartition[] | undefined,
  currentClustersData: ClusterWithName[],
  languageId?: string,
): string[] {
  if (comparedClusterIds.length === 0) return [];

  // 返回带有分区的集群ID列表
  const clusterIdsWithPartition = currentClustersPartitionsData?.map((item) => item.clusterId);
  const uniqueClusterIdsWithPartition = [...new Set(clusterIdsWithPartition)];
  // 筛选出集群分区获取失败的情况
  const missingPartitionClusters = comparedClusterIds
    .filter((clusterId) => !uniqueClusterIdsWithPartition.includes(clusterId))
    .map((id) => {
      const clusterName = currentClustersData.find((c) => c.id === id)?.name;
      return getI18nConfigCurrentText(clusterName, languageId) || id;
    });

  return missingPartitionClusters;
}

export function getClusterNames(
  clusterIds: string[],
  currentClustersData: ClusterWithName[],
  languageId?: string,
): string[] {
  const clusterNames = clusterIds.map((id) => {
    const clusterName = currentClustersData.find((c) => c.id === id)?.name;
    return getI18nConfigCurrentText(clusterName, languageId) || id;
  });

  return clusterNames;
}
