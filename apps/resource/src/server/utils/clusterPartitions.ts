interface PartitionRule {
  clusterId: string;
  partition: string;
}

// 仅获取当前在线的集群的分区对应的授权结果
export const getAvailablePartitionsResult = <T extends PartitionRule>(
  currentClusterPartitions: Record<string, string[]>,
  recordResult: T[],
) => {
  return recordResult.filter((record) => {
    const filteredPartitions = currentClusterPartitions[record.clusterId];
    return filteredPartitions?.includes(record.partition);
  });
};
