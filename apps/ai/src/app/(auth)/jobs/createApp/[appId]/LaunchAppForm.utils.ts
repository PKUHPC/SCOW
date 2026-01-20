import { isValidElement, type ReactNode } from "react";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelectorList";
import { formatSize } from "src/utils/format";

import type {
  CascaderSelection,
  CPUQueueRow,
  GPUQueueRow,
  ImageSourceKey,
  MaxTimeUnit,
  QueueRow,
  QueueStats,
  VersionGroup,
  VersionLookupEntry,
} from "./LaunchAppForm.types";

const CATEGORY_VALUE_PRIVATE = 1;
const CATEGORY_VALUE_PUBLIC = 2;

export const createSelectionLookupKey = (id: number, isPrivate: boolean) =>
  `${id}:${isPrivate ? "1" : "0"}`;

// 将任意 React 节点展开为可读的纯文本
export const resolveText = (value: ReactNode | string | number | undefined): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((child) => resolveText(child)).join("");
  }
  if (isValidElement(value)) {
    return resolveText(value.props?.children);
  }
  return "";
};

// 拼装“名称（版本）”形式的展示字符串，用于作业详情的算法数据集模型展示
export const formatNameVersion = (groupName: string, versionName: string) => {
  const trimmedGroup = groupName.trim();
  const trimmedVersion = versionName.trim();

  if (trimmedGroup && trimmedVersion) {
    return `${trimmedGroup}（${trimmedVersion}）`;
  }
  if (trimmedGroup) {
    return trimmedGroup;
  }
  if (trimmedVersion) {
    return `${trimmedVersion}`;
  }
  return "";
};

// 构建版本 ID 到元数据（私有标记与展示文本）的映射
export const buildVersionLookup = (
  personal?: VersionGroup[],
  shared?: VersionGroup[],
): Map<number, VersionLookupEntry> => {
  const map = new Map<number, VersionLookupEntry>();

  const register = (groups: VersionGroup[] | undefined, isPrivate: boolean) => {
    groups?.forEach((group) => {
      const groupName = resolveText(group.name ?? group.label);
      group.versions?.forEach((version) => {
        const versionName = resolveText(version.versionName ?? version.label);
        const display = formatNameVersion(groupName, versionName) || groupName || versionName || String(version.id);

        if (version.id === undefined) {
          return;
        }

        if (map.has(version.id)) {
          const existing = map.get(version.id);
          if (existing?.isPrivate) {
            return;
          }
        }

        map.set(version.id, {
          isPrivate,
          currentNameVersion: display,
        });
      });
    });
  };

  register(personal, true);
  register(shared, false);

  return map;
};

// 将级联选择结果转换为后端所需的数据结构
export const toIdPrivateList = (
  selections: CascaderSelection[] | undefined,
  lookup: Map<number, VersionLookupEntry>,
) => {
  if (!selections || selections.length === 0) {
    return [];
  }

  const result: { id: number; isPrivate: boolean; currentNameVersion?: string }[] = [];

  selections.forEach((path) => {
    const leaf = path?.[path.length - 1];
    const category = path?.[0];
    const id = typeof leaf === "string" ? Number(leaf) : leaf;
    if (id === undefined || Number.isNaN(id)) {
      return;
    }
    const meta = lookup.get(id);

    const normalizedCategory = typeof category === "string" ? Number(category) : category;
    let isPrivateFlag: boolean;
    if (normalizedCategory === CATEGORY_VALUE_PRIVATE) {
      isPrivateFlag = true;
    } else if (normalizedCategory === CATEGORY_VALUE_PUBLIC) {
      isPrivateFlag = false;
    } else {
      isPrivateFlag = Boolean(meta?.isPrivate);
    }

    result.push({
      id,
      isPrivate: isPrivateFlag,
      currentNameVersion: meta?.currentNameVersion,
    });
  });

  return result;
};

// 将级联控件的标签格式化成可展示文本
export const renderCascaderLabels = (labels: ReactNode[]) => labels
  .map((label) => resolveText(label))
  .filter((text) => Boolean(text))
  .join(" / ");

// 选出第一个可用的队列 ID
export const pickFirstEnabledQueueId = (rows: QueueRow[]): string | undefined =>
  rows.find((row) => !row.disabled)?.id;

// 根据当前队列计算底部统计数据
export const deriveQueueStats = (queue: QueueRow | undefined): QueueStats => {
  if (!queue) {
    return {
      totalUnits: 0,
      cpuPerUnit: 0,
      memoryPerUnitText: "-",
      memoryPerUnitMb: undefined,
      qosOptions: [],
    };
  }

  const isGpu = queue.type === "gpu";

  return {
    totalUnits: queue.totalUnits,
    cpuPerUnit: isGpu ? queue.cpuPerGpu ?? 0 : 1,
    memoryPerUnitText: isGpu ? queue.memoryPerGpu ?? "-" : queue.memoryPerCore ?? "-",
    memoryPerUnitMb: isGpu ? queue.memoryPerGpuMb : queue.memoryPerCoreMb,
    qosOptions: queue.qosOptions ?? [],
  };
};

// 将后端返回的队列数据拆分成 GPU 与 CPU 两类表格行
export const mapQueuesToRows = (queueData: Record<string, any>[] | undefined) => {
  if (!queueData) {
    return { gpuRows: [] as GPUQueueRow[], cpuRows: [] as CPUQueueRow[] };
  }

  const gpuRows: GPUQueueRow[] = [];
  const cpuRows: CPUQueueRow[] = [];

  queueData.forEach((queue) => {
    const totalNodes = queue.nodes ?? 1;
    const totalGpus = queue.gpus ?? 0;
    const idleGpus = queue.idleGpus ?? 0;
    const totalCpus = queue.cores ?? 0;
    const idleCpus = queue.idleCores ?? 0;
    const acceleratorDescriptions: string[] = queue.acceleratorDescriptions ?? [];

    if (totalGpus > 0) {
      const perGpuCpu = queue.gpus && queue.gpus > 0 ? queue.cores / queue.gpus : undefined;
      const perGpuMemMb = queue.gpus && queue.gpus > 0 ? queue.memMb / queue.gpus : undefined;
      const formattedPerGpuCpu = perGpuCpu ? Number(perGpuCpu.toFixed(2)) : undefined;
      const formattedPerGpuMem = perGpuMemMb ? formatSize(perGpuMemMb, ["MB", "GB", "TB"]) : undefined;

      gpuRows.push({
        id: queue.name,
        queue: queue.name,
        accelerator: queue.gpuModel ?? queue.gpuType ?? "-",
        acceleratorDetail: acceleratorDescriptions[0],
        acceleratorVramGb: queue.vramMb ? Math.round(queue.vramMb / 1024) : undefined,
        capacity: `${idleGpus}/${totalGpus || 0}`,
        cpuModel: queue.cpuModel ?? "-",
        disabled: idleGpus <= 0,
        totalUnits: totalGpus,
        idleUnits: idleGpus,
        qosOptions: queue.qos ?? [],
        cpuPerGpu: formattedPerGpuCpu,
        memoryPerGpu: formattedPerGpuMem,
        memoryPerGpuMb: perGpuMemMb,
        gpuType: queue.gpuType,
        maxAcceleratorsPerPod: queue.maxAcceleratorsPerPod,
        type: "gpu",
        totalNodes,
      });

      return;
    }

    const perCpuMemMb = queue.cores && queue.cores > 0 ? queue.memMb / queue.cores : undefined;
    const formattedPerCpuMem = perCpuMemMb ? formatSize(perCpuMemMb, ["MB", "GB", "TB"]) : undefined;

    cpuRows.push({
      id: queue.name,
      queue: queue.name,
      cpuModel: queue.cpuModel ?? "-",
      cpuDetail: acceleratorDescriptions[0],
      capacity: `${idleCpus}/${totalCpus || 0}`,
      memoryPerCore: formattedPerCpuMem,
      memoryPerCoreMb: perCpuMemMb,
      disabled: idleCpus <= 0,
      totalUnits: totalCpus,
      idleUnits: idleCpus,
      qosOptions: queue.qos ?? [],
      type: "cpu",
      totalNodes,
    });
  });

  return { gpuRows, cpuRows };
};

// 构建资源版本 ID 到级联选择路径的映射，便于再次提交时恢复选项
export const buildSelectionPathLookup = (
  categories?: ResourceCategory[],
): Map<string, CascaderSelection> => {
  const map = new Map<string, CascaderSelection>();
  if (!categories || categories.length === 0) {
    return map;
  }

  const traverse = (nodes: ResourceCategory[] | undefined, path: CascaderSelection) => {
    if (!nodes?.length) {
      return;
    }
    nodes.forEach((node) => {
      const nextPath: CascaderSelection = [...path, node.value];
      const children = node.children as ResourceCategory[] | undefined;
      if (children?.length) {
        traverse(children, nextPath);
        return;
      }
      const rawValue = node.value;
      const numericId = typeof rawValue === "string" ? Number(rawValue) : rawValue;
      if (numericId === undefined || Number.isNaN(numericId)) {
        return;
      }
      const rootValue = nextPath[0];
      const rootNumeric = typeof rootValue === "string" ? Number(rootValue) : rootValue;
      const isPrivate = rootNumeric === CATEGORY_VALUE_PRIVATE;
      const key = createSelectionLookupKey(numericId, Boolean(isPrivate));
      if (!map.has(key)) {
        map.set(key, nextPath);
      }
    });
  };

  traverse(categories, []);

  return map;
};


// 将前端选择的作业最长运行时长单位转换成小时比例，易于和后端约定保持一致
const HOURS_PER_UNIT: Record<MaxTimeUnit, number> = {
  min: 1 / 60,
  hour: 1,
  day: 24,
};

// 把任意单位的持续时长转成小时，便于后续同一口径的数值计算与校验
export const convertDurationToHours = (value: number, unit: MaxTimeUnit): number =>
  value * HOURS_PER_UNIT[unit];

// 组合镜像来源和镜像值生成缓存 key，用于记忆不同镜像来源的启动命令
export const getCommandCacheKey = (source: ImageSourceKey, imageValue: string | undefined) => {
  if (source === "mine" || source === "public") {
    return `${source}:${imageValue ?? "__none__"}`;
  }
  return source;
};
