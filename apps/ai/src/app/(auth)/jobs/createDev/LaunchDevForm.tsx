"use client";

import { PageContainer } from "@scow/lib-web/build/layouts/base/PageContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App,Button, Form, Space, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { join } from "path";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ImageType, Status } from "src/models/Image";
import { TrainJobInput as DevJobInput } from "src/server/trpc/route/jobs/jobs";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { PublicImageOption } from "../PublicImageOption";
import { BaseInfoSection } from "./components/BaseInfoSection";
import { DevConfigSection } from "./components/DevConfigSection";
import { ResourceConfigSection } from "./components/ResourceConfigSection";
import {
  BorderlessCard,
  FixedFooter,
  FooterActions,
  FooterStats,
  FooterStatValue,
  HeaderRow,
  HeaderTitle,
  PaddedCard,
  SectionTitle,
} from "./LaunchDevForm.styles";
import type {
  AppFormValues,
  BaseFormValues,
  CPUQueueRow,
  DevImageSourceKey,
  GPUQueueRow,
  ImageOption,
  ImageSourceDraft,
  MaxTimeUnit,
  MountPointField,
  QueueKind,
  QueueRow,
  ResourceFormValues,
} from "./LaunchDevForm.types";
import {
  convertDurationToHours,
  deriveQueueStats,
  mapQueuesToRows,
} from "./LaunchDevForm.utils";

// ======================= 类型定义 =======================
interface Props {
  createDevParams?: DevJobInput;
  misPath: string;
}

const p = prefix("app.jobs.launchAppForm.");
const pDev = prefix("app.jobs.launchDevForm.");

type LaunchDevFormKey = Parameters<typeof p>[0];
type ImageSourceLabelKey = Extract<LaunchDevFormKey, `imageSourceTabs.${string}`>;
type ImagePlaceholderKey = Extract<LaunchDevFormKey, `imagePlaceholders.${string}`>;
type QueueFooterLabelKey = Extract<LaunchDevFormKey, `queueFooterLabels.${string}`>;

// 镜像来源配置（label & placeholder 的 key）
const IMAGE_SOURCE_TAB_CONFIG: readonly {
  key: DevImageSourceKey;
  labelKey: ImageSourceLabelKey;
  placeholderKey: ImagePlaceholderKey;
}[] = [
  { key: "mine", labelKey: "imageSourceTabs.mine", placeholderKey: "imagePlaceholders.mine" },
  { key: "public", labelKey: "imageSourceTabs.public", placeholderKey: "imagePlaceholders.public" },
  { key: "remote", labelKey: "imageSourceTabs.remote", placeholderKey: "imagePlaceholders.remote" },
];

const IMAGE_PLACEHOLDER_KEYS: Record<DevImageSourceKey, ImagePlaceholderKey> = {
  mine: "imagePlaceholders.mine",
  public: "imagePlaceholders.public",
  remote: "imagePlaceholders.remote",
} as const;

// 根据队列类型自定义底部统计栏的字段文案
const QUEUE_LABEL_KEYS: Record<QueueKind,
  { gpu: QueueFooterLabelKey; cpu: QueueFooterLabelKey; memory: QueueFooterLabelKey }> = {
  gpu: {
    gpu: "queueFooterLabels.totalGpu",
    cpu: "queueFooterLabels.totalCpu",
    memory: "queueFooterLabels.totalMemory",
  },
  cpu: {
    gpu: "queueFooterLabels.totalGpu",
    cpu: "queueFooterLabels.totalCpu",
    memory: "queueFooterLabels.totalMemory",
  },
};

type TranslateFn = ReturnType<typeof useI18nTranslateToString>;

// GPU 队列表格列定义，包含显卡信息与资源情况
const buildGpuColumns = (t: TranslateFn): ColumnsType<GPUQueueRow> => [
  {
    title: t(p("gpuColumns.queue")),
    dataIndex: "queue",
    key: "queue",
    width: "20%",
  },
  {
    title: t(p("gpuColumns.accelerator")),
    dataIndex: "accelerator",
    key: "accelerator",
    width: "20%",
    render: (_: unknown, record: GPUQueueRow) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>{record.accelerator}</Typography.Text>
        {record.acceleratorDetail ? (
          <Typography.Text>{record.acceleratorDetail}</Typography.Text>
        ) : null}
        {record.acceleratorVramGb ? (
          <Typography.Text>{t(p("gpuColumns.vram"), [record.acceleratorVramGb])}</Typography.Text>
        ) : null}
      </Space>
    ),
  },
  {
    title: t(p("gpuColumns.capacity")),
    dataIndex: "capacity",
    key: "capacity",
    width: "20%",
  },
  {
    title: t(p("gpuColumns.perGpuAllocation")),
    dataIndex: "perGpuAllocation",
    key: "perGpuAllocation",
    width: "20%",
    render: (_: unknown, record: GPUQueueRow) => {
      const cpuText = record.cpuPerGpu ? t(p("gpuColumns.perGpuCpu"), [record.cpuPerGpu]) : "";
      const memText = record.memoryPerGpu ? t(p("gpuColumns.perGpuMemory"), [record.memoryPerGpu]) : "";
      return (
        <Space direction="vertical" size={0}>
          <Typography.Text>{cpuText}</Typography.Text>
          <Typography.Text>{memText}</Typography.Text>
        </Space>
      );
    },
  },
  {
    title: t(p("gpuColumns.cpuModel")),
    dataIndex: "cpuModel",
    key: "cpuModel",
    width: "20%",
    render: (value: string) => value || "-",
  },
];

// CPU 队列列定义，关注核数与内存分配
const buildCpuColumns = (t: TranslateFn): ColumnsType<CPUQueueRow> => [
  {
    title: t(p("cpuColumns.queue")),
    dataIndex: "queue",
    key: "queue",
    width: "25%",
  },
  {
    title: t(p("cpuColumns.cpuModel")),
    dataIndex: "cpuModel",
    key: "cpuModel",
    width: "25%",
    render: (_: unknown, record: CPUQueueRow) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>{record.cpuModel}</Typography.Text>
        {record.cpuDetail ? (
          <Typography.Text type="secondary">{record.cpuDetail}</Typography.Text>
        ) : null}
      </Space>
    ),
  },
  {
    title: t(p("cpuColumns.capacity")),
    dataIndex: "capacity",
    key: "capacity",
    width: "25%",
  },
  {
    title: t(p("cpuColumns.memoryPerCore")),
    dataIndex: "memoryPerCore",
    key: "memoryPerCore",
    width: "25%",
    render: (text?: string) => text ?? "-",
  },
];


// ======================= 组件实现 =======================
// 主表单组件，协调基础信息、资源配置与应用配置三个分区，并负责数据提交
export const LaunchDevForm = ({
  createDevParams,misPath,
}: Props) => {
  const { currentLanguage } = useI18n();
  const languageId = currentLanguage.id;
  const t = useI18nTranslateToString();
  // const i18n = useI18n();
  const { publicConfig, scowClusterConfigs, currentAvailableClusterIds } = usePublicConfig();
  const { CLUSTERS } = publicConfig;
  const router = useRouter();

  const {
    data: userPartitions,
    isLoading: partitionLoading,
  } = trpc.resource.getUserAssociatedClusterPartitions.useQuery();
  const {
    data: allClustersInfo,
    isLoading: allClustersLoading,
  } = trpc.dashboard.getAllClustersInfo.useQuery(
    { clusterIds: currentAvailableClusterIds },
    { enabled: currentAvailableClusterIds.length > 0 },
  );

  const availableClusters = useMemo(() => {
    if (partitionLoading || allClustersLoading) {
      return [];
    }

    const devHostEnabledClusters = CLUSTERS.filter((cluster) =>
      scowClusterConfigs[cluster.id]?.ai?.devHost?.enabled);

    if (userPartitions?.clusterPartitions === undefined) {
      return devHostEnabledClusters.map((cluster) => {
        const clusterInfo = allClustersInfo?.clusters.find((c) => c.clusterId === cluster.id);
        return {
          id: cluster.id,
          name: getI18nConfigCurrentText(cluster.name, currentLanguage.id),
          partitions: clusterInfo?.partitions ?? [],
        };
      });
    }

    const clusterPartitions = userPartitions.clusterPartitions;
    return devHostEnabledClusters
      .filter((cluster) => {
        const partitionNames = clusterPartitions?.[cluster.id];
        return partitionNames && partitionNames.length > 0;
      })
      .map((cluster) => {
        const userPartitionNames = clusterPartitions[cluster.id] || [];
        const clusterInfo = allClustersInfo?.clusters.find((c) => c.clusterId === cluster.id);
        const partitions = clusterInfo?.partitions?.filter((p) =>
          userPartitionNames.includes(p.partitionName)) ?? [];

        return {
          id: cluster.id,
          name: getI18nConfigCurrentText(cluster.name, currentLanguage.id),
          partitions,
        };
      });
  }, [
    CLUSTERS,
    allClustersInfo,
    allClustersLoading,
    currentLanguage.id,
    partitionLoading,
    scowClusterConfigs,
    userPartitions,
  ]);

  const { message } = App.useApp();
  // ======================= 状态与引用 =======================
  const [baseForm] = Form.useForm<BaseFormValues>();
  const [resourceForm] = Form.useForm<ResourceFormValues>();
  const [appForm] = Form.useForm<AppFormValues>();
  const gpuColumns = useMemo(() => buildGpuColumns(t), [languageId, t]);
  const cpuColumns = useMemo(() => buildCpuColumns(t), [languageId, t]);
  const imageSourceTabs = useMemo(
    () => IMAGE_SOURCE_TAB_CONFIG.map((tab) => ({
      key: tab.key,
      label: t(p(tab.labelKey)),
    })),
    [languageId, t],
  );
  const handleJobNameChange = (value: string) => {
    setJobName(value);
    baseForm.setFieldValue("appJobName", value);
  };

  const handleActiveResourceTabChange = (tab: QueueKind) => {
    setActiveResourceTab(tab);
  };

  const handleQueueSelect = (queueId: string | undefined) => {
    setSelectedQueueKey(queueId);
  };

  const handleMaxTimeUnitChange = (unit: MaxTimeUnit) => {
    setMaxTimeUnit(unit);
  };


  // 生成默认作业名称，帮助用户快速提交
  const initialJobName =
  useMemo(() => `dev-${dayjs().format("YYMMDD-HHmmss")}`.toLowerCase(), []);
  const [jobName, setJobName] = useState(initialJobName);
  const [activeResourceTab, setActiveResourceTab] = useState<QueueKind>("gpu");
  const [selectedQueueKey, setSelectedQueueKey] = useState<string | undefined>();
  const [selectedImageSource, setSelectedImageSource] = useState<DevImageSourceKey>("mine");

  // 记录不同镜像来源下用户填写的草稿，切换标签时可恢复
  const imageSourceDraftsRef = useRef<Record<DevImageSourceKey, ImageSourceDraft>>({
    mine: {},
    public: {},
    remote: {},
  });

  // 缓存每种镜像来源的默认命令和用户修改，用于切换镜像时恢复输入框内容
  // 防止同步命令时触发双向写入造成的死循环
  const previousClusterRef = useRef<string | undefined>(undefined);
  const hasClusterSelectionRef = useRef(false);
  const hasClusterSwitchedRef = useRef(false);
  const isClusterResettingRef = useRef(false);
  const resubmitImageAppliedRef = useRef(false);
  const resubmitResourceAppliedRef = useRef(false);
  const resubmitQueueAppliedRef = useRef(false);
  const resubmitQueueEverAppliedRef = useRef(false);
  const resubmitImageSignatureRef = useRef<string | undefined>(undefined);
  const resubmitMountEnvAppliedRef = useRef(false);
  const [maxTimeUnit, setMaxTimeUnit] = useState<MaxTimeUnit>("hour");

  // ----------- 表单字段监听 -----------
  // 通过 Form.useWatch 实时感知三个分表单中的关键字段，后续计算和副作用均依赖这些最新值
  const selectedAccount = Form.useWatch<string | undefined>("account", resourceForm);
  const selectedCluster = Form.useWatch<string | undefined>("cluster", resourceForm);
  const selectedImageValue = Form.useWatch("image", appForm);
  const usePrivateRemoteImage = Form.useWatch("usePrivateImage", appForm);

  // 作业优先级、资源选择等字段也需要实时同步，用于派生 UI 状态及参数校验
  const priority = Form.useWatch("priority", resourceForm) ?? "";
  const selectedGpuCount = Form.useWatch("gpuCores", resourceForm) ?? 0;
  const selectedCpuCount = Form.useWatch("cpuCores", resourceForm) ?? 0;

  const { data: accountListData } = trpc.account.listAccounts.useQuery(
    { clusterId: selectedCluster },
    { enabled: Boolean(selectedCluster) },
  );

  const accountOptions = useMemo(() => (
    (accountListData?.accounts ?? []).map((account) => ({
      label: account,
      value: account,
    }))
  ), [accountListData]);

  // ----------- 服务请求与变更提示 -----------
  // 提交开发机任务的 RPC 请求，集中处理成功跳转和常见错误提示
  const createDevJobMutation = trpc.devHost.createDevHost.useMutation({
    onSuccess: () => {
      message.success(t(pDev("submitDevSuccessfully")));
      router.push("/jobs/devList");
    },
    onError: (error) => {
      const detail = error.data?.detailedError;
      if (detail?.type === "account_user_not_available") {
        message.error(
          t(p("submitFailedAccountUserUnavailable"), [detail.accountName ?? "", detail.userId ?? ""]),
        );
        return;
      }
      if (detail?.type === "cluster_partition_not_available" && detail.partitionName) {
        const clusterName = CLUSTERS.find((x) => x.id === detail.clusterId)?.name || detail.clusterId;
        const i18nClusterName = getI18nConfigCurrentText(clusterName, languageId);
        message.error(
          t(
            p("submitFailedAccountPartitionUnavailable"),
            [detail.accountName ?? "", i18nClusterName, detail.partitionName],
          ),
        );
        return;
      }
      message.error(t(pDev("submitDevFailed"), [error.message]));
    },
  });

  // 提交前去除挂载点的多余空白项，避免后端收到空值
  const sanitizeAppFormValues = () => {
    const { mountPoints } = appForm.getFieldsValue();

    const sanitizedMountPoints = (mountPoints ?? [])
      .map((item) => ({
        source: typeof item?.source === "string" ? item.source.trim() : "",
        target: typeof item?.target === "string" ? item.target.trim() : "",
      }))
      .filter((item): item is MountPointField => Boolean(item.source || item.target));

    appForm.setFieldsValue({
      mountPoints: sanitizedMountPoints,
    });
  };

  // ----- 在外部状态变化时同步表单值 -----
  // 当用户切换集群、或从预填数据恢复到不同集群时，需要清理依赖于集群的字段，避免旧值残留
  // 处理「再次提交」场景下的账户/集群回填，确保历史选择优先生效
  useEffect(() => {
    const previousCluster = previousClusterRef.current;
    if (previousCluster === selectedCluster) {
      return;
    }
    const hadClusterSelection = hasClusterSelectionRef.current;
    previousClusterRef.current = selectedCluster;
    if (selectedCluster !== undefined) {
      hasClusterSelectionRef.current = true;
    }
    if (previousCluster === undefined && selectedCluster === undefined) {
      return;
    }
    if (hadClusterSelection) {
      hasClusterSwitchedRef.current = true;
    }
    const shouldReset = hadClusterSelection;
    isClusterResettingRef.current = true;

    resubmitImageAppliedRef.current = false;
    // 如果已应用过再次提交的队列，则不再重复应用，保持用户后续选择
    if (!resubmitQueueEverAppliedRef.current) {
      resubmitQueueAppliedRef.current = false;
    }
    resubmitMountEnvAppliedRef.current = shouldReset;
    if (shouldReset) {
      resourceForm.setFieldsValue({ priority: undefined });
      appForm.setFieldsValue({
        image: undefined,
        usePrivateImage: false,
        remoteUsername: undefined,
        remotePassword: undefined,
        mountPoints: [],
      });
      imageSourceDraftsRef.current = {
        mine: {},
        public: {},
        remote: {},
      };
      setSelectedQueueKey(undefined);
      setSelectedImageSource("mine");
    }

    Promise.resolve().then(() => {
      isClusterResettingRef.current = false;
    });
  }, [appForm, resourceForm, selectedCluster]);

  // ----------- 交互处理逻辑 -----------
  const handleImageSourceChange = (nextSource: DevImageSourceKey) => {
    // 在切换标签前保存当前填写的数据，便于恢复
    const currentDraft: ImageSourceDraft = {
      image: appForm.getFieldValue("image"),
    };

    if (selectedImageSource === "remote") {
      currentDraft.usePrivateImage = appForm.getFieldValue("usePrivateImage");
      currentDraft.remoteUsername = appForm.getFieldValue("remoteUsername");
      currentDraft.remotePassword = appForm.getFieldValue("remotePassword");
    }

    imageSourceDraftsRef.current[selectedImageSource] = currentDraft;

    resubmitImageAppliedRef.current = true;
    setSelectedImageSource(nextSource);
  };

  // ----------- 表单校验边界 -----------
  const maxJobRunningTimeHours = useMemo(() => {
    if (selectedCluster && scowClusterConfigs[selectedCluster]?.ai?.devHost?.maxRunningTimeHours) {
      return scowClusterConfigs[selectedCluster].ai.devHost.maxRunningTimeHours;
    }
    return publicConfig.MAX_JOB_RUNNING_TIME_HOURS;
  }, [publicConfig.MAX_JOB_RUNNING_TIME_HOURS, scowClusterConfigs, selectedCluster]);

  // 根据选中的账户与集群拉取对应的队列与资源详情
  // ----- 数据拉取：根据选中账户/集群实时刷新依赖数据 -----
  const { data: queueData, isLoading: getAvailablePartitionIsLoading } =
    trpc.config.getAvailablePartitions.useQuery(
      { accountName: selectedAccount!, clusterId: selectedCluster! },
      { enabled: !!selectedAccount && !!selectedCluster },
    );

  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery({
    isPublic: selectedImageSource === "public" ? parseBooleanParam(true) : parseBooleanParam(false),
    clusterId: selectedCluster,
    withExternal: "true",
    types: ImageType.DEV_HOST,
  }, {
    enabled: !!selectedCluster && (selectedImageSource === "public" || selectedImageSource === "mine"),
  });

  useEffect(() => {
    if (!createDevParams) {
      resubmitMountEnvAppliedRef.current = false;
      return;
    }
    if (resubmitMountEnvAppliedRef.current) {
      return;
    }

    const mountPointsDraft = (createDevParams.mountPoints ?? [])
      .map((item) => {
        const path = typeof (item as { path?: string })?.path === "string"
          ? (item as { path?: string }).path!.trim()
          : "";
        const target = typeof (item as { target?: string })?.target === "string"
          ? (item as { target?: string }).target!.trim()
          : "";
        return {
          source: path,
          target,
        };
      })
      .filter((item) => item.source || item.target);

    appForm.setFieldsValue({
      mountPoints: mountPointsDraft,
    });

    resubmitMountEnvAppliedRef.current = true;
  }, [appForm, createDevParams]);

  // 如果用户来自「再次提交」或历史记录，提前解析镜像相关的偏好设置
  const resubmitImagePreference = useMemo(() => {
    if (!createDevParams) {
      return undefined;
    }

    if (createDevParams.remoteImageUrl) {
      const draft: ImageSourceDraft = {
        image: createDevParams.remoteImageUrl,
        usePrivateImage: Boolean(createDevParams.privateImageRepositoryCredentials),
        remoteUsername: createDevParams.privateImageRepositoryCredentials?.userName,
        remotePassword: createDevParams.privateImageRepositoryCredentials?.password,
      };
      return {
        source: "remote" as const,
        draft,
      };
    }

    if (createDevParams.image !== undefined && createDevParams.image !== null) {
      const draft: ImageSourceDraft = {
        image: String(createDevParams.image),
      };
      return {
        source: createDevParams.isImagePrivate === false ? "public" as const : "mine" as const,
        draft,
      };
    }

    return undefined;
  }, [createDevParams]);

  useEffect(() => {
    // 再次提交信息清空时，重置镜像同步标记
    if (!resubmitImagePreference) {
      resubmitImageSignatureRef.current = undefined;
      resubmitImageAppliedRef.current = false;
      resubmitQueueAppliedRef.current = false;
    }
  }, [resubmitImagePreference]);

  // 聚合镜像下拉的展示数据，支持不同来源的渲染方式
  const imageOptionsForSource = useMemo<ImageOption[]>(() => {
    if (selectedImageSource === "mine" || selectedImageSource === "public") {
      const items = images?.items ?? [];
      return items
        .filter((image) => image.status === Status.CREATED)
        .map((image) => ({
          label: `${image.name}: ${image.tag}`,
          value: String(image.id),
          description: getI18nConfigCurrentText(image.description, languageId),
          rawName: image.name,
          rawTag: image.tag,
          ownerName: image.ownerName,
          ownerId: image.ownerId,
          startCommand: image.startCommand ?? undefined,
          displayLabel: selectedImageSource === "public"
            ? (
              <PublicImageOption
                name={image.name}
                tag={image.tag}
                ownerName={image.ownerName}
                ownerId={image.ownerId}
              />
            )
            : `${image.name}: ${image.tag}`,
        })) as ImageOption[];
    }
    return [];
  }, [images, selectedImageSource, languageId]);

  // 统一选中值的类型，避免数字 ID 与字符串之间的比较问题
  const normalizedSelectedImageValue = selectedImageValue !== undefined && selectedImageValue !== null
    ? String(selectedImageValue)
    : undefined;

  const selectedImageOption = useMemo(
    () => imageOptionsForSource.find((item) => item.value === normalizedSelectedImageValue),
    [imageOptionsForSource, normalizedSelectedImageValue],
  );

  // 根据镜像来源切换 placeholder 文案
  const imagePlaceholder = t(p(IMAGE_PLACEHOLDER_KEYS[selectedImageSource]));

  // ======================= 队列与资源派生数据 =======================
  // 将后端数据拆分成表格所需的 GPU、CPU 行
  // ----- 派生数据：根据当前数据生成队列表行与统计信息 -----
  const { gpuRows, cpuRows } = useMemo(() => mapQueuesToRows(queueData), [queueData]);
  const queueRowById = useMemo(() => {
    const map = new Map<string, QueueRow>();
    gpuRows.forEach((row) => map.set(row.id, row));
    cpuRows.forEach((row) => map.set(row.id, row));
    return map;
  }, [cpuRows, gpuRows]);

  // 按当前标签筛出实际展示的队列集合
  const currentQueueOptions: QueueRow[] =
    activeResourceTab === "gpu" ? gpuRows : cpuRows;

  // 结合选中主键获取当前行，用于派生底部统计和表单限制
  const selectedQueueOption = useMemo(
    () => currentQueueOptions.find((option) => option.id === selectedQueueKey),
    [currentQueueOptions, selectedQueueKey],
  );

  const normalizedNodeCount = 1;
  const normalizedGpuPerNode = Math.max(0, Number(selectedGpuCount ?? 0));
  const normalizedCpuPerNode = Math.max(0, Number(selectedCpuCount ?? 0));
  const totalGpuUnits = normalizedGpuPerNode * normalizedNodeCount;
  const totalCpuUnits = normalizedCpuPerNode * normalizedNodeCount;

  const {
    cpuPerUnit,
    memoryPerUnitText,
    memoryPerUnitMb,
    qosOptions,
  } = useMemo(
    () => deriveQueueStats(selectedQueueOption),
    [selectedQueueOption],
  );

  const gpuUnitLimit = useMemo(() => {
    if (selectedQueueOption?.type !== "gpu") {
      return undefined;
    }
    const candidates: number[] = [selectedQueueOption.totalUnits];
    if (typeof selectedQueueOption.maxAcceleratorsPerPod === "number"
      && selectedQueueOption.maxAcceleratorsPerPod > 0) {
      candidates.push(selectedQueueOption.maxAcceleratorsPerPod);
    }
    return candidates.length ? Math.min(...candidates) : undefined;
  }, [selectedQueueOption]);

  const {
    gpu: gpuLabelKey,
    cpu: cpuLabelKey,
    memory: memoryLabelKey,
  } = QUEUE_LABEL_KEYS[activeResourceTab];
  const gpuLabel = t(p(gpuLabelKey));
  const cpuLabel = t(p(cpuLabelKey));
  const memoryLabel = t(p(memoryLabelKey));

  const displayedGpu = activeResourceTab === "gpu"
    ? (totalGpuUnits > 0 ? totalGpuUnits : "-")
    : "-";

  const displayedCpu = (() => {
    if (activeResourceTab === "gpu") {
      if (totalGpuUnits > 0 && cpuPerUnit) {
        const totalCpu = cpuPerUnit * totalGpuUnits;
        return Number.isInteger(totalCpu) ? totalCpu : totalCpu.toFixed(2);
      }
      return "-";
    }
    return totalCpuUnits > 0 ? totalCpuUnits : "-";
  })();

  const displayedMemory = (() => {
    const units = activeResourceTab === "gpu" ? totalGpuUnits : totalCpuUnits;
    if (units <= 0) {
      return "-";
    }
    if (memoryPerUnitMb) {
      return formatSize(memoryPerUnitMb * units, ["MB", "GB", "TB"]);
    }
    return memoryPerUnitText;
  })();

  const unitsForQuery = activeResourceTab === "gpu" ? totalGpuUnits : totalCpuUnits;
  const hasMemoryPerUnit = memoryPerUnitMb !== undefined && memoryPerUnitMb !== null && !Number.isNaN(memoryPerUnitMb);
  const memMbForQuery = hasMemoryPerUnit
    ? Math.max(0, Math.round(unitsForQuery * (memoryPerUnitMb ?? 0)))
    : 0;
  const timeSecondsForPrice = 3600;
  // 仅在关键字段齐备、并且能计算出每单位内存时才触发价格查询，避免无效请求
  const jobPriceQueryEnabled =
    Boolean(selectedAccount && selectedCluster && selectedQueueKey && priority) &&
    hasMemoryPerUnit &&
    unitsForQuery > 0;

  const { data: jobOneHourPrice } = trpc.jobs.calculateJobPrice.useQuery({
    cluster: selectedCluster!,
    partition: selectedQueueKey!,
    account: selectedAccount!,
    gpu: totalGpuUnits,
    cpusAlloc: totalCpuUnits,
    memMb: memMbForQuery,
    qos: priority,
    timeSeconds: timeSecondsForPrice,
  }, {
    enabled: jobPriceQueryEnabled,
  });

  const formattedHourlyPrice = jobOneHourPrice == null ? "-" : `${jobOneHourPrice.toFixed(2)} ${t(p("yuan"))}`;

  const clusterOptions = useMemo(() => (
    availableClusters.map((cluster) => ({
      id: cluster.id,
      name: cluster.name,
      disabled: false,
    }))
  ), [availableClusters]);

  useEffect(() => {
    // 再次提交时回填账户与集群，避免默认值覆盖历史配置
    if (!createDevParams) {
      resubmitResourceAppliedRef.current = false;
      return;
    }
    if (resubmitResourceAppliedRef.current) {
      return;
    }

    const targetAccount = createDevParams.account;
    const targetCluster = createDevParams.clusterId;

    const accountAvailable = targetAccount
      ? accountOptions.some((option) => option.value === targetAccount)
      : false;

    const targetClusterOption = targetCluster
      ? clusterOptions.find((option) => option.id === targetCluster && !option.disabled)
      : undefined;

    const clusterExists = Boolean(targetClusterOption);

    const nextValues: Partial<ResourceFormValues> = {};

    if (accountAvailable && resourceForm.getFieldValue("account") !== targetAccount) {
      nextValues.account = targetAccount;
    }

    if (clusterExists && resourceForm.getFieldValue("cluster") !== targetCluster) {
      nextValues.cluster = targetCluster;
    }

    if (Object.keys(nextValues).length > 0) {
      resourceForm.setFieldsValue(nextValues);
    }

    if ((targetAccount ? accountAvailable : true) && (targetCluster ? clusterExists : true)) {
      resubmitResourceAppliedRef.current = true;
    }
  }, [accountOptions, clusterOptions, createDevParams, resourceForm]);

  useEffect(() => {
    // 再次提交时回填队列、优先级与核心/加速卡数以及运行时长
    if (!createDevParams) {
      resubmitQueueAppliedRef.current = false;
      return;
    }
    if (!queueRowById.size || resubmitQueueAppliedRef.current) {
      return;
    }

    if (!selectedCluster) {
      return;
    }

    if (createDevParams.clusterId && selectedCluster && createDevParams.clusterId !== selectedCluster) {
      return;
    }

    const targetQueueId = createDevParams.partition;
    const targetQueue = targetQueueId ? queueRowById.get(targetQueueId) : undefined;

    const nextTab: QueueKind = targetQueue?.type
      ?? ((createDevParams.gpuCount ?? 0) > 0 ? "gpu" : "cpu");

    if (activeResourceTab !== nextTab) {
      setActiveResourceTab(nextTab);
    }

    let maxTimeValue: number | undefined;
    if (createDevParams.maxTime !== undefined && createDevParams.maxTime !== null) {
      const minutes = Math.max(1, createDevParams.maxTime);
      let unit: MaxTimeUnit = "min";
      let value = minutes;
      if (minutes % (24 * 60) === 0) {
        unit = "day";
        value = minutes / (24 * 60);
      } else if (minutes % 60 === 0) {
        unit = "hour";
        value = minutes / 60;
      }
      setMaxTimeUnit(unit);
      maxTimeValue = value;
    }

    if (!targetQueue) {
      if (selectedQueueKey !== undefined) {
        setSelectedQueueKey(undefined);
      }
      resourceForm.setFieldsValue({
        priority: undefined,
        gpuCores: undefined,
        cpuCores: undefined,
        ...(maxTimeValue !== undefined ? { maxTime: maxTimeValue } : {}),
      });
      resubmitQueueAppliedRef.current = true;
      return;
    }

    if (targetQueueId && selectedQueueKey !== targetQueueId) {
      setSelectedQueueKey(targetQueueId);
    }

    const updates: Partial<ResourceFormValues> = {};
    const qosList = targetQueue.qosOptions ?? [];
    if (createDevParams.qos) {
      if (qosList.includes(createDevParams.qos)) {
        updates.priority = createDevParams.qos;
      } else {
        updates.priority = undefined;
      }
    } else {
      updates.priority = undefined;
    }

    if (maxTimeValue !== undefined) {
      updates.maxTime = maxTimeValue;
    }

    if (targetQueue.type === "gpu") {
      const gpuUnits = Number(createDevParams.gpuCount ?? 0);
      updates.gpuCores = gpuUnits > 0 ? Math.max(1, gpuUnits) : undefined;
      updates.cpuCores = undefined;
    } else {
      const cpuUnits = Number(createDevParams.coreCount ?? 0);
      updates.cpuCores = cpuUnits > 0 ? Math.max(1, cpuUnits) : undefined;
      updates.gpuCores = undefined;
    }

    if (Object.keys(updates).length > 0) {
      resourceForm.setFieldsValue(updates);
    }

    resubmitQueueAppliedRef.current = true;
    resubmitQueueEverAppliedRef.current = true;
  }, [
    activeResourceTab,
    cpuRows,
    createDevParams,
    gpuRows,
    queueRowById,
    resourceForm,
    selectedCluster,
    setActiveResourceTab,
    setMaxTimeUnit,
    setSelectedQueueKey,
  ]);

  // 单位或配置上限变化时触发校验，让用户看到最新提示
  useEffect(() => {
    const currentValue = resourceForm.getFieldValue("maxTime");
    if (currentValue !== undefined && currentValue !== null) {
      resourceForm.validateFields(["maxTime"]);
    }
  }, [maxTimeUnit, maxJobRunningTimeHours, resourceForm]);

  // 将生成的作业名称与表单字段保持一致，便于 Form 校验
  useEffect(() => {
    baseForm.setFieldsValue({ appJobName: jobName });
  }, [baseForm, jobName]);

  // 队列数据变化时，保持或回退到可用的第一条记录
  useEffect(() => {
    if (!currentQueueOptions.length) {
      if (selectedQueueKey !== undefined) {
        setSelectedQueueKey(undefined);
      }
      return;
    }

    if (createDevParams && !resubmitQueueAppliedRef.current) {
      return;
    }

    const currentSelection = currentQueueOptions.find(
      (option) => option.id === selectedQueueKey,
    );
    if (!currentSelection) {
      const savedQueueId = createDevParams?.partition;
      if (createDevParams && selectedQueueKey === savedQueueId) {
        if (selectedQueueKey !== undefined) {
          setSelectedQueueKey(undefined);
        }
        return;
      }
      const fallbackId = currentQueueOptions[0]?.id;
      if (fallbackId) {
        setSelectedQueueKey(fallbackId);
      } else if (selectedQueueKey !== undefined) {
        setSelectedQueueKey(undefined);
      }
    }
  }, [createDevParams, currentQueueOptions, selectedQueueKey]);

  // 若用户尚未选择账户，自动填入第一条有效账户
  useEffect(() => {
    if (createDevParams && !resubmitResourceAppliedRef.current) {
      return;
    }
    if (!accountOptions.length) {
      resourceForm.setFieldValue("account", undefined);
      return;
    }

    const currentAccount = selectedAccount ?? resourceForm.getFieldValue("account");

    if (!currentAccount || !accountOptions.some((option) => option.value === currentAccount)) {
      resourceForm.setFieldValue("account", accountOptions[0].value);
    }
  }, [accountOptions, createDevParams, resourceForm, selectedAccount]);

  // 可用集群列表变化时，若当前集群不可用则自动切换到第一个可用集群
  useEffect(() => {
    if (createDevParams && !resubmitResourceAppliedRef.current) {
      return;
    }
    if (!clusterOptions.length) {
      resourceForm.setFieldValue("cluster", undefined);
      return;
    }
    const currentCluster = selectedCluster ?? resourceForm.getFieldValue("cluster");
    const exists = currentCluster
      ? clusterOptions.some((option) => option.id === currentCluster)
      : false;
    if (!exists) {
      resourceForm.setFieldValue("cluster", clusterOptions[0].id);
    }
  }, [clusterOptions, createDevParams, resourceForm, selectedCluster]);

  // 与标签状态保持同步，确保 queue 字段符合 GPU / CPU 的切换
  useEffect(() => {
    resourceForm.setFieldValue("queue", activeResourceTab);
  }, [resourceForm, activeResourceTab]);

  useEffect(() => {
    // 确保当前标签的核心数有默认值（不覆盖已填或再次提交的有效值）
    const field = activeResourceTab === "gpu" ? "gpuCores" : "cpuCores";
    const currentValue = resourceForm.getFieldValue(field);
    if (currentValue === undefined || currentValue === null) {
      resourceForm.setFieldValue(field, 1);
    }
  }, [activeResourceTab, resourceForm, selectedQueueOption]);

  // 切换镜像来源时恢复已保存的选项
  useEffect(() => {
    const draft = imageSourceDraftsRef.current[selectedImageSource] ?? {};

    if (selectedImageSource === "remote") {
      appForm.setFieldsValue({
        image: draft.image,
        usePrivateImage: draft.usePrivateImage ?? false,
        remoteUsername: draft.remoteUsername,
        remotePassword: draft.remotePassword,
      });
    } else {
      appForm.setFieldsValue({
        image: draft.image,
        usePrivateImage: false,
        remoteUsername: undefined,
        remotePassword: undefined,
      });
    }
  }, [appForm, selectedImageSource]);

  useEffect(() => {
    // 再次提交时回填镜像来源、镜像值以及私有仓库信息（等待集群重置完成）
    if (!resubmitImagePreference) {
      return;
    }

    if (resubmitImageAppliedRef.current) {
      return;
    }

    if (isClusterResettingRef.current) {
      resubmitImageAppliedRef.current = false;
      return;
    }

    const { source, draft } = resubmitImagePreference;
    if (hasClusterSwitchedRef.current) {
      imageSourceDraftsRef.current = {
        mine: {},
        public: {},
        remote: {},
      };
      resubmitImageAppliedRef.current = true;
      return;
    }
    const signature = JSON.stringify({
      source,
      image: draft.image ?? null,
      usePrivateImage: draft.usePrivateImage ?? false,
      remoteUsername: draft.remoteUsername ?? null,
      remotePassword: draft.remotePassword ?? null,
    });

    if (resubmitImageSignatureRef.current !== signature) {
      resubmitImageAppliedRef.current = false;
      resubmitImageSignatureRef.current = signature;
    }
    const currentImage = appForm.getFieldValue("image");
    const currentSource = selectedImageSource;
    const desiredImage = draft.image;
    const isRemote = source === "remote";
    const isLocalLibrary = source === "mine" || source === "public";

    const remoteMatches = !isRemote || (
      currentImage === desiredImage
      && Boolean(appForm.getFieldValue("usePrivateImage")) === Boolean(draft.usePrivateImage)
      && appForm.getFieldValue("remoteUsername") === draft.remoteUsername
      && appForm.getFieldValue("remotePassword") === draft.remotePassword
    );

    if (isLocalLibrary) {
      if (currentSource !== source) {
        setSelectedImageSource(source);
        return;
      }
      if (isImagesLoading) {
        return;
      }
      if (!desiredImage || !imageOptionsForSource.some((option) => option.value === desiredImage)) {
        imageSourceDraftsRef.current[source] = {};
        appForm.setFieldsValue({
          image: undefined,
          usePrivateImage: false,
          remoteUsername: undefined,
          remotePassword: undefined,
        });
        resubmitImageAppliedRef.current = true;
        return;
      }
    }

    if (isRemote && !desiredImage) {
      imageSourceDraftsRef.current.remote = {};
      appForm.setFieldsValue({
        image: undefined,
        usePrivateImage: draft.usePrivateImage ?? false,
        remoteUsername: draft.remoteUsername,
        remotePassword: draft.remotePassword,
      });
      resubmitImageAppliedRef.current = true;
      return;
    }

    imageSourceDraftsRef.current[source] = draft;

    if (
      currentSource === source
      && currentImage === desiredImage
      && remoteMatches
    ) {
      resubmitImageAppliedRef.current = true;
      return;
    }

    if (resubmitImageAppliedRef.current) {
      return;
    }

    if (currentSource !== source) {
      setSelectedImageSource(source);
      return;
    }

    if (isRemote) {
      appForm.setFieldsValue({
        image: draft.image,
        usePrivateImage: draft.usePrivateImage ?? false,
        remoteUsername: draft.remoteUsername,
        remotePassword: draft.remotePassword,
      });
    } else {
      appForm.setFieldsValue({
        image: draft.image,
        usePrivateImage: false,
        remoteUsername: undefined,
        remotePassword: undefined,
      });
    }

    resubmitImageAppliedRef.current = true;
  }, [
    appForm,
    imageOptionsForSource,
    isImagesLoading,
    resubmitImagePreference,
    selectedImageSource,
  ]);

  useEffect(() => {
    // 当取消勾选私有镜像时，主动清空认证字段，避免提交冗余信息
    if (!usePrivateRemoteImage) {
      appForm.setFieldsValue({
        remoteUsername: undefined,
        remotePassword: undefined,
      });
    }
  }, [appForm, usePrivateRemoteImage]);

  // 随队列变化刷新优先级选项，取第一项作为默认值
  useEffect(() => {
    const qosList = selectedQueueOption?.qosOptions ?? [];
    if (!qosList.length) {
      if (resourceForm.getFieldValue("priority") !== undefined) {
        resourceForm.setFieldValue("priority", undefined);
      }
      return;
    }

    const currentPriority: string | undefined = resourceForm.getFieldValue("priority");

    if (createDevParams) {
      if (!resubmitQueueAppliedRef.current) {
        return;
      }
      const savedPriority = createDevParams.qos;
      const savedQueueId = createDevParams.partition;

      if (savedPriority && qosList.includes(savedPriority)) {
        if (currentPriority !== savedPriority) {
          resourceForm.setFieldValue("priority", savedPriority);
        }
        return;
      }

      if (savedPriority && !qosList.includes(savedPriority)) {
        if (currentPriority !== undefined) {
          resourceForm.setFieldValue("priority", undefined);
        }
        return;
      }

      if (!savedPriority) {
        if (selectedQueueKey === savedQueueId) {
          if (currentPriority !== undefined) {
            resourceForm.setFieldValue("priority", undefined);
          }
          return;
        }
      }
    }

    if (!currentPriority || !qosList.includes(currentPriority)) {
      resourceForm.setFieldValue("priority", qosList[0]);
    }
  }, [createDevParams, resourceForm, selectedQueueKey, selectedQueueOption]);

  const handleCancel = () => {
    router.push("/jobs/devList");
  };

  // ----- 提交逻辑：校验 + 组装 payload + 调用接口 -----
  // 聚合验证三个表单区域，确保必填项完整后续再接入真实提交
  const handleSubmit = async () => {
    sanitizeAppFormValues();
    let baseValues: BaseFormValues;
    let resourceValues: ResourceFormValues;
    let appValues: AppFormValues;
    try {
      [baseValues, resourceValues, appValues] = await Promise.all([
        baseForm.validateFields(),
        resourceForm.validateFields(),
        appForm.validateFields(),
      ]);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        message.error(t(p("completeRequiredFields")));
      }
      console.error("Failed to validate create dev job form:", error);
      return;
    }

    try {
      const {
        account,
        cluster,
        priority: qos,
        cpuCores,
        gpuCores,
        maxTime,
      } = resourceValues;
      const partition = selectedQueueKey;
      const queueOption = selectedQueueOption;

      if (!cluster || !account || !partition || !queueOption) {
        message.error(t(p("selectValidAccountClusterQueue")));
        return;
      }

      const isGpuQueue = queueOption.type === "gpu";
      const parsedGpuUnits = Number(gpuCores ?? 0);
      const parsedCpuUnits = Number(cpuCores ?? 0);

      let perNodeGpuCount = 0;
      let perNodeCpuCount = 0;

      if (isGpuQueue) {
        if (!Number.isFinite(parsedGpuUnits) || parsedGpuUnits <= 0) {
          message.error(t(p("invalidResourceConfig")));
          return;
        }
        perNodeGpuCount = Math.max(1, Math.round(parsedGpuUnits));
        if (cpuPerUnit && cpuPerUnit > 0) {
          perNodeCpuCount = Math.max(1, Math.round(cpuPerUnit * perNodeGpuCount));
        } else if (Number.isFinite(parsedCpuUnits) && parsedCpuUnits > 0) {
          perNodeCpuCount = Math.max(1, Math.round(parsedCpuUnits));
        } else {
          perNodeCpuCount = perNodeGpuCount;
        }
      } else {
        if (!Number.isFinite(parsedCpuUnits) || parsedCpuUnits <= 0) {
          message.error(t(p("invalidResourceConfig")));
          return;
        }
        perNodeCpuCount = Math.max(1, Math.round(parsedCpuUnits));
      }

      const totalGpuUnits = perNodeGpuCount * normalizedNodeCount;
      const totalCpuUnits = perNodeCpuCount * normalizedNodeCount;
      const unitCount = isGpuQueue ? totalGpuUnits : totalCpuUnits;

      if (unitCount <= 0 || totalCpuUnits <= 0) {
        message.error(t(p("invalidResourceConfig")));
        return;
      }

      const memoryMb = memoryPerUnitMb
        ? Math.max(0, Math.round(memoryPerUnitMb * unitCount))
        : undefined;

      const maxTimeMinutes = Math.max(1, Math.round(convertDurationToHours(maxTime, maxTimeUnit) * 60));

      const mountPointsPayload = (appValues.mountPoints ?? [])
        .map((mount) => {
          const source = mount?.source?.trim();
          const target = mount?.target?.trim();
          if (!source || !target) {
            return undefined;
          }
          return { path: source, target };
        })
        .filter((point): point is { path: string; target: string } => Boolean(point));

      let imageId: number | undefined;
      let remoteImageUrl: string | undefined;
      let isImagePrivate: boolean | undefined;

      // 不同镜像来源需要组装不同字段，提前归类成统一 payload
      if (selectedImageSource === "mine" || selectedImageSource === "public") {
        if (normalizedSelectedImageValue) {
          const parsed = Number(normalizedSelectedImageValue);
          if (!Number.isNaN(parsed)) {
            imageId = parsed;
          }
        }
        isImagePrivate = selectedImageSource === "mine";
      } else if (selectedImageSource === "remote") {
        remoteImageUrl = appValues.image?.trim();
        if (!remoteImageUrl) {
          message.error(t(p("remoteImageRequired")));
          return;
        }
      }

      const payload: Parameters<typeof createDevJobMutation.mutateAsync>[0] = {
        clusterId: cluster,
        devHostName: baseValues.appJobName,
        image: imageId,
        isImagePrivate,
        remoteImageUrl,
        account,
        partition,
        qos,
        coreCount: perNodeCpuCount,
        gpuCount: isGpuQueue ? perNodeGpuCount : undefined,
        memory: memoryMb ?? 0,
        maxTimeMinutes,
        ...(mountPointsPayload.length ? { mountPoints: mountPointsPayload } : {}),
        ...(appValues.usePrivateImage ? {
          privateImageRepositoryCredentials: {
            userName: appValues.remoteUsername ?? "",
            password: appValues.remotePassword ?? "",
          },
        } : {}),
      };

      await createDevJobMutation.mutateAsync(payload);
    } catch (error) {
      console.error("Failed to submit create dev job form:", error);
    }
  };

  // ======================= 渲染 =======================
  return (
    <>
      <PageContainer style={{ paddingBottom: "40px" }} direction="vertical" size={16}>
        <PaddedCard
          title={(
            <HeaderRow align="center" size={16}>
              <HeaderTitle>
                {t(pDev("createDevTitle"))}
              </HeaderTitle>
            </HeaderRow>
          )}
        >
          <BorderlessCard title={<SectionTitle>{t(p("basicInfoSectionTitle"))}</SectionTitle>}>
            <BaseInfoSection
              form={baseForm}
              jobName={jobName}
              onJobNameChange={handleJobNameChange}
            />
          </BorderlessCard>
        </PaddedCard>

        <ResourceConfigSection
          form={resourceForm}
          accountOptions={accountOptions}
          clusterOptions={clusterOptions}
          selectedCluster={selectedCluster}
          activeResourceTab={activeResourceTab}
          onActiveResourceTabChange={handleActiveResourceTabChange}
          gpuColumns={gpuColumns}
          cpuColumns={cpuColumns}
          gpuRows={gpuRows}
          cpuRows={cpuRows}
          queueLoading={getAvailablePartitionIsLoading}
          selectedQueueKey={selectedQueueKey}
          onQueueSelect={handleQueueSelect}
          selectedQueueOption={selectedQueueOption}
          qosOptions={qosOptions}
          maxTimeUnit={maxTimeUnit}
          onMaxTimeUnitChange={handleMaxTimeUnitChange}
          maxJobRunningTimeHours={maxJobRunningTimeHours}
          convertDurationToHours={convertDurationToHours}
          gpuUnitLimit={gpuUnitLimit}
        />

        <DevConfigSection
          form={appForm}
          imageSourceTabs={imageSourceTabs}
          selectedImageSource={selectedImageSource}
          onImageSourceChange={handleImageSourceChange}
          imagePlaceholder={imagePlaceholder}
          imageOptions={imageOptionsForSource}
          isImagesLoading={isImagesLoading}
          selectedImageOption={selectedImageOption}
          usePrivateRemoteImage={usePrivateRemoteImage}
          selectedCluster={selectedCluster}
        />

      </PageContainer>

      <FixedFooter>
        <FooterStats>
          <span>{gpuLabel} <FooterStatValue>{displayedGpu}</FooterStatValue></span>
          <span>{cpuLabel} <FooterStatValue>{displayedCpu}</FooterStatValue></span>
          <span>{memoryLabel} <FooterStatValue>{displayedMemory}</FooterStatValue></span>
          <span>{t(p("hourlyCostLabel"))}
            <FooterStatValue $isPrimaryColor>{formattedHourlyPrice}</FooterStatValue>
          </span>
          <a onClick={() => { window.location.href = join(misPath,"/user/partitions"); }}>
            <FooterStatValue $isPrimaryColor>{t(p("chargeStandard"))}</FooterStatValue>
          </a>
        </FooterStats>
        <FooterActions>
          <Button onClick={handleCancel}>{t(p("cancel"))}</Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={createDevJobMutation.isPending}
          >
            {t(p("submit"))}
          </Button>
        </FooterActions>
      </FixedFooter>
    </>
  );
};
