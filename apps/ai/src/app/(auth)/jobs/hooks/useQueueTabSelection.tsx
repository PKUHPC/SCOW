"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type QueueKind = "cpu" | "gpu";

interface QueueRowBase {
  id: string;
  disabled: boolean;
}

interface UseQueueTabSelectionParams<GpuRow extends QueueRowBase, CpuRow extends QueueRowBase> {
  gpuRows: GpuRow[];
  cpuRows: CpuRow[];
  activeResourceTab: QueueKind;
  onActiveResourceTabChange: (tab: QueueKind) => void;
  selectedQueueKey?: string;
  onQueueSelect: (queueId: string | undefined) => void;
  syncQueueField?: (tab: QueueKind) => void;
  isResubmit?: boolean;
}

const sortQueueRowsByDisabled = <Row extends QueueRowBase>(a: Row, b: Row) => {
  if (a.disabled === b.disabled) {
    return 0;
  }
  return a.disabled ? 1 : -1;
};

export const useQueueTabSelection = <GpuRow extends QueueRowBase, CpuRow extends QueueRowBase>({
  gpuRows,
  cpuRows,
  activeResourceTab,
  onActiveResourceTabChange,
  selectedQueueKey,
  onQueueSelect,
  syncQueueField,
  isResubmit,
}: UseQueueTabSelectionParams<GpuRow, CpuRow>) => {
  const accountClusterQueueTouchedRef = useRef({
    account: false,
    cluster: false,
    queue: false,
  });

  const sortedGpuRows = useMemo(() => [...gpuRows].sort(sortQueueRowsByDisabled), [gpuRows]);

  const sortedCpuRows = useMemo(() => [...cpuRows].sort(sortQueueRowsByDisabled), [cpuRows]);

  const applyTabChange = useCallback(
    (tabKey: QueueKind) => {
      onActiveResourceTabChange(tabKey);
      syncQueueField?.(tabKey);

      const options = tabKey === "gpu" ? sortedGpuRows : sortedCpuRows;
      if (!options.length) {
        onQueueSelect(undefined);
        return;
      }

      const hasValidSelection = options.some((option) => option.id === selectedQueueKey);
      if (!hasValidSelection) {
        onQueueSelect(options[0]?.id);
      }
    },
    [onActiveResourceTabChange, onQueueSelect, selectedQueueKey, sortedCpuRows, sortedGpuRows, syncQueueField],
  );

  const handleTabChange = useCallback(
    (key: string) => {
      const tabKey = key as QueueKind;
      accountClusterQueueTouchedRef.current.queue = true;
      applyTabChange(tabKey);
    },
    [applyTabChange],
  );

  const markAccountTouched = useCallback(() => {
    accountClusterQueueTouchedRef.current.account = true;
  }, []);

  const markClusterTouched = useCallback(() => {
    accountClusterQueueTouchedRef.current.cluster = true;
  }, []);

  useEffect(() => {
    accountClusterQueueTouchedRef.current.queue = false;
  }, [sortedCpuRows, sortedGpuRows]);

  useEffect(() => {
    const accountClusterQueueTouched =
      accountClusterQueueTouchedRef.current.account ||
      accountClusterQueueTouchedRef.current.cluster ||
      accountClusterQueueTouchedRef.current.queue;
    // 再次提交 && 账户/集群/队列tab都没被用户修改过时，不执行自动切换
    if (isResubmit && !accountClusterQueueTouched) {
      return;
    }
    // 用户手动切过队列 tab 后，不再用自动逻辑覆盖其选择
    if (accountClusterQueueTouchedRef.current.queue) {
      return;
    }

    // 当前选中的队列在当前 tab 中有效时，不自动切换（保护模板/再次提交设置的分区）
    const currentTabRows = activeResourceTab === "gpu" ? sortedGpuRows : sortedCpuRows;
    if (selectedQueueKey && currentTabRows.some((r) => r.id === selectedQueueKey)) {
      return;
    }

    const nextTab: QueueKind = sortedGpuRows.length === 0 && sortedCpuRows.length > 0 ? "cpu" : "gpu";
    if (activeResourceTab === nextTab) {
      return;
    }

    applyTabChange(nextTab);
  }, [activeResourceTab, applyTabChange, isResubmit, sortedCpuRows, sortedGpuRows]);

  return {
    sortedGpuRows,
    sortedCpuRows,
    handleTabChange,
    markAccountTouched,
    markClusterTouched,
  };
};
