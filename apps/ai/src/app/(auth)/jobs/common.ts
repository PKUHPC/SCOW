import { styled } from "styled-components";

export const FullWidthContainer = styled.div`
  margin: -16px;
  padding: 0;
  width: calc(100% + 32px);
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

export interface ClusterNodeInfo {
  partitions: string[];
  cpuCoreCount: number;
  totalMemMb: number;
  gpuCount: number;
}

export interface ClusterNodesInfo {
  nodeInfo: ClusterNodeInfo[];
}

export const getQueueNodes = (
  nodesInfo: ClusterNodesInfo | undefined,
  queueName: string | undefined,
): ClusterNodeInfo[] => {
  if (!nodesInfo?.nodeInfo?.length || !queueName) {
    return [];
  }
  return nodesInfo.nodeInfo.filter((node) => (node.partitions ?? []).includes(queueName));
};
/**
 * 确定单节点核心数(cpu或gpu)后，队列中每个节点按照核心数、内存计算可调度的最大 Pod 数
 * 累加得出队列支持的最大pod总数
 * 分布式作业的总节点数要小于等于这个Pod数
 */
export const getMaxPodsByNodes = ({
  nodes,
  queueType,
  perNodeUnits,
  memoryPerUnitMb,
}: {
  nodes: ClusterNodeInfo[];
  queueType: "gpu" | "cpu";
  perNodeUnits: number;
  memoryPerUnitMb?: number;
}) => {
  if (!nodes.length || perNodeUnits <= 0 || Number.isNaN(perNodeUnits)) {
    return { maxPods: undefined, resourceMaxPods: undefined, memMaxPods: undefined };
  }

  const resourceMaxPods = nodes.reduce((sum, node) => {
    const totalUnits = queueType === "gpu" ? node.gpuCount : node.cpuCoreCount;
    return sum + Math.floor(totalUnits / perNodeUnits);
  }, 0);

  const perNodeMemMb = memoryPerUnitMb ? perNodeUnits * memoryPerUnitMb : undefined;
  const memMaxPods = perNodeMemMb && perNodeMemMb > 0
    ? nodes.reduce((sum, node) => sum + Math.floor(node.totalMemMb / perNodeMemMb), 0)
    : undefined;

  const podLimitCandidates = [resourceMaxPods, memMaxPods].filter(
    (value): value is number => value !== undefined,
  );
  const maxPods = podLimitCandidates.length ? Math.min(...podLimitCandidates) : undefined;

  return { maxPods, resourceMaxPods, memMaxPods };
};

export const validateMountPoints = (
  mountsDuplicateText: string,
  workingDirText: string = "",
) => ({ getFieldValue }: { getFieldValue: (name: string) => any }) => ({
  validator(_: any, value?: string) {
    const currentValueNormalized = (value ?? "").replace(/\/+$/, "");

    const rawMountPoints: unknown[] = getFieldValue("mountPoints") ?? [];
    const mountPoints = rawMountPoints
      .map((mountPoint): string | undefined => {
        if (!mountPoint) { return undefined; }
        if (typeof mountPoint === "string") { return mountPoint; }
        if (typeof mountPoint === "object" && "source" in mountPoint) {
          const source = (mountPoint as { source?: unknown }).source;
          return typeof source === "string" ? source : undefined;
        }
        return undefined;
      })
      .filter((mountPoint): mountPoint is string => Boolean(mountPoint))
      .map((mountPoint) => mountPoint.replace(/\/+$/, ""));

    const currentIndex = mountPoints.findIndex((point) => point === currentValueNormalized);

    const otherMountPoints = mountPoints.filter((_, idx) => idx !== currentIndex);
    if (otherMountPoints.includes(currentValueNormalized)) {
      return Promise.reject(new Error(mountsDuplicateText));
    }

    const workingDirectory = getFieldValue("customFields")?.workingDir?.toString();
    if (workingDirectory && workingDirectory.replace(/\/+$/, "") === currentValueNormalized) {
      return Promise.reject(new Error(workingDirText));
    }

    return Promise.resolve();
  },
});

export const validateEnvKeyFormat = (
  invalidFormatText: string,
  duplicateText: string,
) => ({ getFieldValue }: { getFieldValue: (name: string) => any }) => ({
  validator(_: any, value: string) {
    // 正则校验，检查环境变量名称格式
    const pattern = /^[A-Z_][A-Z0-9_]*$/;
    if (!value || pattern.test(value)) {
      // 如果格式合法，继续检查重复性
      const envVariables: string[] = getFieldValue("envVariables")
        .filter((env: any) => env?.key)
        .map((env: any) => env.key.replace(/\/+$/, ""));

      // 检查是否已有相同的环境变量名称
      const currentIndex = envVariables.indexOf(value);
      const otherEnvVariables = envVariables.filter((_, idx) => idx !== currentIndex);

      if (otherEnvVariables.includes(value)) {
        return Promise.reject(new Error(duplicateText));
      }

      return Promise.resolve();
    }

    return Promise.reject(new Error(invalidFormatText)); // 如果格式不合法，返回格式错误
  },
});
