import { createContainerMountTargetPathValidator } from "@scow/lib-web/build/utils/form";
import { PREDEFINED_ENV_VAR } from "src/models/envVars";
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

    const envVars: { key?: string; value?: string }[] = getFieldValue("envVariables") ?? [];
    const workingDirectory = envVars.find((e) => e?.key === PREDEFINED_ENV_VAR.WORK_DIR)?.value?.toString();
    if (workingDirectory && workingDirectory.replace(/\/+$/, "") === currentValueNormalized) {
      return Promise.reject(new Error(workingDirText));
    }

    return Promise.resolve();
  },
});

/**
 * 校验挂载目标路径（target）在所有参与列表中不重复。
 *
 * 每个列表项的结构为 { target?: string }，validator 会收集
 * allListNames 中所有列表的 target 值，排除当前字段自身后检查是否有重名。
 *
 * @param allListNames  需要一起参与重名检查的 Form.List 字段名列表
 *                      例如 ["datasets", "algorithms", "models", "mountPoints"]
 * @param selfListName  当前字段所在的 Form.List 字段名
 * @param selfIndex     当前字段在所在列表中的下标（用于排除自身）
 * @param duplicateText 重名时的错误提示文案
 */
type NamePath = string | number | (string | number)[];

export const validateTargetUnique = (
  allListNames: string[],
  selfListName: string,
  selfIndex: number,
  duplicateText: string,
) => ({ getFieldValue }: { getFieldValue: (name: NamePath) => any }) => ({
  validator(_: any, value?: string) {
    if (!value || !value.trim()) {
      return Promise.resolve();
    }
    const normalized = value.trim().replace(/\/+$/, "");

    const allTargets: { listName: string; index: number; target: string }[] = [];
    for (const listName of allListNames) {
      const items: unknown[] = getFieldValue(listName) ?? [];
      items.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const raw = (item as Record<string, unknown>)["target"];
        if (typeof raw !== "string" || !raw.trim()) return;
        allTargets.push({ listName, index, target: raw.trim().replace(/\/+$/, "") });
      });
    }

    const hasDuplicate = allTargets.some(
      ({ listName, index, target }) =>
        target === normalized && !(listName === selfListName && index === selfIndex),
    );

    if (hasDuplicate) {
      return Promise.reject(new Error(duplicateText));
    }
    return Promise.resolve();
  },
});

/**
 * 创建挂载目标路径（target）通用校验规则。
 *
 * 该规则组合了两个校验：
 * 1. target 不能直接挂载到根目录 "/"；
 * 2. target 在数据集、算法、模型、自定义挂载点等参与列表中不能重复。
 *
 * @param allListNames       需要一起参与 target 重名检查的 Form.List 字段名列表
 * @param selfListName       当前字段所在的 Form.List 字段名
 * @param selfIndex          当前字段在所在列表中的下标，用于排除当前字段自身
 * @param rootNotAllowedText target 为根目录时的错误提示文案
 * @param duplicateText      target 重复时的错误提示文案
 */
export const createMountTargetRules = (
  allListNames: string[],
  selfListName: string,
  selfIndex: number,
  rootNotAllowedText: string,
  duplicateText: string,
  pathMessages?: {
    unsafeCharacter?: string;
    pathTraversal?: string;
    currentDirectory?: string;
    absoluteRequired?: string;
    systemPathNotAllowed?: string;
  },
) => [
  createContainerMountTargetPathValidator({
    rootNotAllowed: rootNotAllowedText,
    ...pathMessages,
  }),
  validateTargetUnique(allListNames, selfListName, selfIndex, duplicateText),
];

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
