"use client";

import { PageContainer } from "@scow/lib-web/build/layouts/base/PageContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Space, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { join } from "path";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelectorList";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ImageType, Status } from "src/models/Image";
import { TrainJobInput } from "src/server/trpc/route/jobs/jobs";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";

import { PublicImageOption } from "../PublicImageOption";
import { BaseInfoSection } from "./components/BaseInfoSection";
import { ResourceConfigSection } from "./components/ResourceConfigSection";
import { TrainConfigSection } from "./components/TrainConfigSection";
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
} from "./LaunchTrainForm.styles";
import type {
  BaseFormValues,
  CascaderSelection,
  CommandCacheEntry,
  CPUQueueRow,
  EnvVariableField,
  GPUQueueRow,
  ImageOption,
  ImageSourceDraft,
  MaxTimeUnit,
  MountPointField,
  QueueKind,
  QueueRow,
  ResourceFormValues,
  TrainAppFormValues,
  TrainFramework,
  TrainImageSourceKey,
  VersionGroup,
} from "./LaunchTrainForm.types";
import {
  buildSelectionPathLookup,
  buildVersionLookup,
  convertDurationToHours,
  createSelectionLookupKey,
  deriveQueueStats,
  getCommandCacheKey,
  mapQueuesToRows,
  renderCascaderLabels,
  toIdPrivateList,
} from "../LaunchJobForm.utils";

// ======================= 类型定义 =======================
interface Props {
  createTrainParams?: TrainJobInput;
  misPath: string;
}

const p = prefix("app.jobs.launchAppForm.");
const pTrain = prefix("app.jobs.launchTrainForm.");
type LaunchTrainFormKey = Parameters<typeof p>[0];
type ImageSourceLabelKey = Extract<LaunchTrainFormKey, `imageSourceTabs.${string}`>;
type ImagePlaceholderKey = Extract<LaunchTrainFormKey, `imagePlaceholders.${string}`>;
type QueueFooterLabelKey = Extract<LaunchTrainFormKey, `queueFooterLabels.${string}`>;

// 镜像来源配置（label & placeholder 的 key）
const IMAGE_SOURCE_TAB_CONFIG: readonly {
  key: TrainImageSourceKey;
  labelKey: ImageSourceLabelKey;
  placeholderKey: ImagePlaceholderKey;
}[] = [
  { key: "mine", labelKey: "imageSourceTabs.mine", placeholderKey: "imagePlaceholders.mine" },
  { key: "public", labelKey: "imageSourceTabs.public", placeholderKey: "imagePlaceholders.public" },
  { key: "remote", labelKey: "imageSourceTabs.remote", placeholderKey: "imagePlaceholders.remote" },
];

const IMAGE_PLACEHOLDER_KEYS: Record<TrainImageSourceKey, ImagePlaceholderKey> = {
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

const DEFAULT_FRAMEWORKS: TrainFramework[] = ["single", "tensorflow", "pytorch", "mpi"];

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
export const LaunchTrainForm = ({
  createTrainParams, misPath,
}: Props) => {
  const { currentLanguage } = useI18n();
  const languageId = currentLanguage.id;
  const t = useI18nTranslateToString();
  // const i18n = useI18n();
  const { publicConfig, currentAvailableClusterIds } = usePublicConfig();
  const { CLUSTERS } = publicConfig;
  const router = useRouter();

  const { message } = App.useApp();
  // ======================= 状态与引用 =======================
  const [baseForm] = Form.useForm<BaseFormValues>();
  const [resourceForm] = Form.useForm<ResourceFormValues>();
  const [appForm] = Form.useForm<TrainAppFormValues>();
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
  useMemo(() => `train-${dayjs().format("YYMMDD-HHmmss")}`.toLowerCase(), []);
  const [jobName, setJobName] = useState(initialJobName);
  const [activeResourceTab, setActiveResourceTab] = useState<QueueKind>("gpu");
  const [selectedQueueKey, setSelectedQueueKey] = useState<string | undefined>();
  const [selectedImageSource, setSelectedImageSource] = useState<TrainImageSourceKey>("mine");

  const [frameworkOptions, setFrameworkOptions] = useState<TrainFramework[]>(DEFAULT_FRAMEWORKS);

  // 记录不同镜像来源下用户填写的草稿，切换标签时可恢复
  const imageSourceDraftsRef = useRef<Record<TrainImageSourceKey, ImageSourceDraft>>({
    mine: {},
    public: {},
    remote: {},
  });

  // 缓存每种镜像来源的默认命令和用户修改，用于切换镜像时恢复输入框内容
  const commandCacheRef = useRef<Record<string, CommandCacheEntry>>({});
  // 防止同步命令时触发双向写入造成的死循环
  const isSyncingCommandRef = useRef(false);
  const previousClusterRef = useRef<string | undefined>(undefined);
  const hasClusterSelectionRef = useRef(false);
  const hasClusterSwitchedRef = useRef(false);
  const isClusterResettingRef = useRef(false);
  const resubmitImageAppliedRef = useRef(false);
  const resubmitResourceAppliedRef = useRef(false);
  const resubmitQueueAppliedRef = useRef(false);
  const resubmitQueueEverAppliedRef = useRef(false);
  const resubmitImageSignatureRef = useRef<string | undefined>(undefined);
  const resubmitCascaderAppliedRef = useRef({
    datasets: false,
    algorithms: false,
    models: false,
  });
  const resubmitMountEnvAppliedRef = useRef(false);
  const resubmitTensorBoardAppliedRef = useRef(false);
  const [maxTimeUnit, setMaxTimeUnit] = useState<MaxTimeUnit>("hour");

  // 账户集群关系
  const { data: appAvailableAccountsAndClusters } =
  trpc.jobs.listAppAvailableAccountsAndClusters.useQuery({});

  const accountClusterMap = appAvailableAccountsAndClusters?.accountClusters ?? {};

  // 账户下拉选项根据 cluster 关联关系动态生成
  const accountOptions = useMemo(() => (
    Object.keys(accountClusterMap).map((account) => ({
      label: account,
      value: account,
    }))
  ), [accountClusterMap]);

  // ----------- 表单字段监听 -----------
  // 通过 Form.useWatch 实时感知三个分表单中的关键字段，后续计算和副作用均依赖这些最新值
  const selectedAccount = Form.useWatch<string | undefined>("account", resourceForm);
  const selectedCluster = Form.useWatch<string | undefined>("cluster", resourceForm);
  const selectedImageValue = Form.useWatch("image", appForm);
  const usePrivateRemoteImage = Form.useWatch("usePrivateImage", appForm);
  const commandValue = Form.useWatch("command", appForm) ?? "";

  // 作业优先级、资源选择等字段也需要实时同步，用于派生 UI 状态及参数校验
  const priority = Form.useWatch("priority", resourceForm) ?? "";
  const selectedGpuCount = Form.useWatch("gpuCores", resourceForm) ?? 0;
  const selectedCpuCount = Form.useWatch("cpuCores", resourceForm) ?? 0;
  const selectedFramework = Form.useWatch<TrainFramework>("framework", resourceForm) ?? "single";
  const nodeUnitCount = Form.useWatch<number>("nodeUnitCount", resourceForm);
  const psNodeCount = Form.useWatch<number>("psNodeCount", resourceForm);
  const workerNodeCount = Form.useWatch<number>("workerNodeCount", resourceForm);
  const distributedNodeCount = Form.useWatch<number>("distributedNodeCount", resourceForm);

  useEffect(() => {
    const defaults: Partial<ResourceFormValues> = {};
    if (!resourceForm.getFieldValue("framework")) {
      defaults.framework = "single";
    }
    if (resourceForm.getFieldValue("nodeUnitCount") == null) {
      defaults.nodeUnitCount = 1;
    }
    if (resourceForm.getFieldValue("psNodeCount") == null) {
      defaults.psNodeCount = 0;
    }
    if (resourceForm.getFieldValue("workerNodeCount") == null) {
      defaults.workerNodeCount = 1;
    }
    if (resourceForm.getFieldValue("distributedNodeCount") == null) {
      defaults.distributedNodeCount = 2;
    }
    if (Object.keys(defaults).length) {
      resourceForm.setFieldsValue(defaults);
    }
  }, [resourceForm]);

  // ----------- 服务请求与变更提示 -----------
  // 提交训练作业的 RPC 请求，集中处理成功跳转和常见错误提示
  const createTrainJobMutation = trpc.jobs.trainJob.useMutation({
    onSuccess: () => {
      message.success(t(pTrain("submitTrainSuccessfully")));
      router.push("/jobs/jobList");
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
      message.error(`${t(pTrain("submitTrainFailed"))}: ${error.message}`);
    },
  });

  // 提交前去除挂载点、环境变量的多余空白项，避免后端收到空值
  const sanitizeAppFormValues = () => {
    const { mountPoints, envVariables } = appForm.getFieldsValue();

    const sanitizedMountPoints = (mountPoints ?? [])
      .map((item) => ({
        source: typeof item?.source === "string" ? item.source.trim() : "",
        target: typeof item?.target === "string" ? item.target.trim() : "",
      }))
      .filter((item): item is MountPointField => Boolean(item.source || item.target));
    const sanitizedEnvVariables = (envVariables ?? [])
      .map((item) => ({
        key: typeof item?.key === "string" ? item.key.trim() : "",
        value: typeof item?.value === "string" ? item.value.trim() : "",
      }))
      .filter((item): item is EnvVariableField => Boolean(item.key || item.value));

    appForm.setFieldsValue({
      mountPoints: sanitizedMountPoints,
      envVariables: sanitizedEnvVariables,
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
    resubmitCascaderAppliedRef.current = {
      datasets: shouldReset,
      algorithms: shouldReset,
      models: shouldReset,
    };
    resubmitMountEnvAppliedRef.current = shouldReset;
    if (shouldReset) {
      resourceForm.setFieldsValue({ priority: undefined });
      appForm.setFieldsValue({
        image: undefined,
        command: undefined,
        usePrivateImage: false,
        remoteUsername: undefined,
        remotePassword: undefined,
        datasets: [],
        algorithms: [],
        models: [],
        mountPoints: [],
        envVariables: [],
        needTensorBoard: false,
        tensorBoardDataPath: undefined,
      });
      imageSourceDraftsRef.current = {
        mine: {},
        public: {},
        remote: {},
      };
      setSelectedQueueKey(undefined);
      commandCacheRef.current = {};
      isSyncingCommandRef.current = false;
      setSelectedImageSource("mine");
    }

    Promise.resolve().then(() => {
      isClusterResettingRef.current = false;
    });
  }, [appForm, resourceForm, selectedCluster]);

  // ----------- 交互处理逻辑 -----------
  const handleImageSourceChange = (nextSource: TrainImageSourceKey) => {
    // 在切换标签前保存当前填写的数据，便于恢复
    const currentDraft: ImageSourceDraft = {
      image: appForm.getFieldValue("image"),
      command: appForm.getFieldValue("command"),
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
  // 集群配置可能限制最大运行时长，这里提前取出供校验和提示使用
  const maxJobRunningTimeHours = publicConfig.MAX_JOB_RUNNING_TIME_HOURS;

  // 根据选中的账户与集群拉取对应的队列与资源详情
  // ----- 数据拉取：根据选中账户/集群实时刷新依赖数据 -----
  const { data: queueData, isLoading: getAvailablePartitionIsLoading } =
    trpc.config.getAvailablePartitions.useQuery(
      { accountName: selectedAccount!, clusterId: selectedCluster! },
      { enabled: !!selectedAccount && !!selectedCluster },
    );

  const { data: queueNodesInfo } = trpc.dashboard.getClusterNodesInfo.useQuery(
    { clusterId:selectedCluster! },
    { enabled: !!queueData && !!selectedCluster },
  );

  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery({
    isPublic: selectedImageSource === "public" ? parseBooleanParam(true) : parseBooleanParam(false),
    clusterId: selectedCluster,
    withExternal: "true",
    types: ImageType.TRAIN,
  }, {
    enabled: !!selectedCluster && (selectedImageSource === "public" || selectedImageSource === "mine"),
  });

  const { data: algorithms, isLoading: isAlgorithmsLoading } = trpc.algorithm.getAllAlgorithmVersions.useQuery({
    clusterId: selectedCluster,
  }, {
    enabled: !!selectedCluster,
  });

  const { data: datasets, isLoading: isDatasetsLoading } = trpc.dataset.getAllDatasetVersions.useQuery({
    clusterId: selectedCluster,
  }, {
    enabled: !!selectedCluster,
  });

  const { data: models, isLoading: isModelsLoading } = trpc.model.getAllModelVersions.useQuery({
    clusterId: selectedCluster,
  }, {
    enabled: !!selectedCluster,
  });

  // 构造算法/数据集/模型的级联选项结构
  const algorithmCategories = useMemo<ResourceCategory[]>(() => {
    const personalChildren = (algorithms?.personal ?? []).map((algorithm) => ({
      label: algorithm.name,
      value: algorithm.id,
      description: algorithm.description,
      children: (algorithm.versions ?? []).map((version) => ({
        label: version.versionName,
        value: version.id,
        description: version.versionDescription,
        children: [],
      })),
    })).filter((algorithm) => algorithm.children.length > 0);

    const publicChildren = (algorithms?.public ?? []).map((algorithm) => ({
      label: algorithm.name,
      value: algorithm.id,
      description: algorithm.description,
      children: (algorithm.versions ?? []).map((version) => ({
        label: version.versionName,
        value: version.id,
        description: version.versionDescription,
        children: [],
      })),
    })).filter((algorithm) => algorithm.children.length > 0);

    const categories: ResourceCategory[] = [];
    if (personalChildren.length > 0) {
      categories.push({
        label: t(p("algorithmCategories.mine")),
        value: 1,
        children: personalChildren,
      });
    }
    if (publicChildren.length > 0) {
      categories.push({
        label: t(p("algorithmCategories.public")),
        value: 2,
        children: publicChildren,
      });
    }
    return categories;
  }, [algorithms, languageId, t]);

  // 数据集与模型同样构造树形层级，过滤掉缺少版本的数据项
  const datasetCategories = useMemo<ResourceCategory[]>(() => {
    const personalChildren = (datasets?.personal ?? []).map((dataset) => ({
      label: dataset.name,
      value: dataset.id,
      description: dataset.description,
      children: (dataset.versions ?? []).map((version) => ({
        label: version.versionName,
        value: version.id,
        description: version.versionDescription,
        children: [],
      })),
    })).filter((dataset) => dataset.children.length > 0);

    const publicChildren = (datasets?.public ?? []).map((dataset) => ({
      label: dataset.name,
      value: dataset.id,
      description: dataset.description,
      children: (dataset.versions ?? []).map((version) => ({
        label: version.versionName,
        value: version.id,
        description: version.versionDescription,
        children: [],
      })),
    })).filter((dataset) => dataset.children.length > 0);

    const categories: ResourceCategory[] = [];
    if (personalChildren.length > 0) {
      categories.push({
        label: t(p("datasetCategories.mine")),
        value: 1,
        children: personalChildren,
      });
    }
    if (publicChildren.length > 0) {
      categories.push({
        label: t(p("datasetCategories.public")),
        value: 2,
        children: publicChildren,
      });
    }
    return categories;
  }, [datasets, languageId, t]);

  const modelCategories = useMemo<ResourceCategory[]>(() => {
    const personalChildren = (models?.personal ?? []).map((model) => ({
      label: model.name,
      value: model.id,
      description: model.description ?? [model.algorithmName, model.algorithmFramework].filter(Boolean).join(" / "),
      children: (model.versions ?? []).map((version) => ({
        label: version.versionName,
        value: version.id,
        description: version.versionDescription ?? version.algorithmVersion ?? undefined,
        children: [],
      })),
    })).filter((model) => model.children.length > 0);

    const publicChildren = (models?.public ?? []).map((model) => ({
      label: model.name,
      value: model.id,
      description: model.description ?? [model.algorithmName, model.algorithmFramework].filter(Boolean).join(" / "),
      children: (model.versions ?? []).map((version) => ({
        label: version.versionName,
        value: version.id,
        description: version.versionDescription ?? version.algorithmVersion ?? undefined,
        children: [],
      })),
    })).filter((model) => model.children.length > 0);

    const categories: ResourceCategory[] = [];
    if (personalChildren.length > 0) {
      categories.push({
        label: t(p("modelCategories.mine")),
        value: 1,
        children: personalChildren,
      });
    }
    if (publicChildren.length > 0) {
      categories.push({
        label: t(p("modelCategories.public")),
        value: 2,
        children: publicChildren,
      });
    }
    return categories;
  }, [models, languageId, t]);

  // 预构建 id → 路径 的查找表，方便再次提交时把后端记录转回级联路径
  const datasetSelectionLookup = useMemo(
    () => buildSelectionPathLookup(datasetCategories),
    [datasetCategories],
  );

  const algorithmSelectionLookup = useMemo(
    () => buildSelectionPathLookup(algorithmCategories),
    [algorithmCategories],
  );

  const modelSelectionLookup = useMemo(
    () => buildSelectionPathLookup(modelCategories),
    [modelCategories],
  );

  const resolveSelectionPath = (
    lookup: Map<string, CascaderSelection>,
    id: number,
    isPrivate: boolean,
  ) => {
    const primary = lookup.get(createSelectionLookupKey(id, isPrivate));
    if (primary) { return primary; }
    return lookup.get(createSelectionLookupKey(id, !isPrivate));
  };

  // 回填数据集选择：等待级联树构造完成后，再把历史选择恢复到表单
  useEffect(() => {
    if (!createTrainParams) {
      resubmitCascaderAppliedRef.current.datasets = false;
      return;
    }
    if (resubmitCascaderAppliedRef.current.datasets) {
      return;
    }
    if (!datasetSelectionLookup.size) {
      return;
    }

    const selections = (createTrainParams.datasets ?? [])
      .map((item) => {
        return resolveSelectionPath(datasetSelectionLookup, item.id, Boolean(item.isPrivate));
      })
      .filter((path): path is CascaderSelection => Boolean(path))
      .map((path) => [...path]);

    appForm.setFieldsValue({
      datasets: selections.length ? selections : [],
    });

    resubmitCascaderAppliedRef.current.datasets = true;
  }, [appForm, createTrainParams, datasetSelectionLookup]);

  // 回填算法选择，同上
  useEffect(() => {
    if (!createTrainParams) {
      resubmitCascaderAppliedRef.current.algorithms = false;
      return;
    }
    if (resubmitCascaderAppliedRef.current.algorithms) {
      return;
    }
    if (!algorithmSelectionLookup.size) {
      return;
    }

    const selections = (createTrainParams.algorithms ?? [])
      .map((item) => {
        return resolveSelectionPath(algorithmSelectionLookup, item.id, Boolean(item.isPrivate));
      })
      .filter((path): path is CascaderSelection => Boolean(path))
      .map((path) => [...path]);

    appForm.setFieldsValue({
      algorithms: selections.length ? selections : [],
    });

    resubmitCascaderAppliedRef.current.algorithms = true;
  }, [algorithmSelectionLookup, appForm, createTrainParams]);

  // 回填模型选择，同上
  useEffect(() => {
    if (!createTrainParams) {
      resubmitCascaderAppliedRef.current.models = false;
      return;
    }
    if (resubmitCascaderAppliedRef.current.models) {
      return;
    }
    if (!modelSelectionLookup.size) {
      return;
    }

    const selections = (createTrainParams.models ?? [])
      .map((item) => {
        return resolveSelectionPath(modelSelectionLookup, item.id, Boolean(item.isPrivate));
      })
      .filter((path): path is CascaderSelection => Boolean(path))
      .map((path) => [...path]);

    appForm.setFieldsValue({
      models: selections.length ? selections : [],
    });

    resubmitCascaderAppliedRef.current.models = true;
  }, [appForm, createTrainParams, modelSelectionLookup]);

  useEffect(() => {
    if (!createTrainParams) {
      resubmitMountEnvAppliedRef.current = false;
      resubmitTensorBoardAppliedRef.current = false;
      return;
    }
    if (resubmitMountEnvAppliedRef.current) {
      return;
    }

    const mountPointsDraft = (createTrainParams.mountPoints ?? [])
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

    const envVariablesDraft = (createTrainParams.envVariables ?? [])
      .filter((env): env is { key: string; value: string } => Boolean(env?.key) && Boolean(env?.value))
      .map((env) => ({ key: env.key, value: env.value }));

    appForm.setFieldsValue({
      mountPoints: mountPointsDraft,
      envVariables: envVariablesDraft,
    });

    resubmitMountEnvAppliedRef.current = true;
  }, [appForm, createTrainParams]);

  useEffect(() => {
    if (!createTrainParams) {
      return;
    }
    if (resubmitTensorBoardAppliedRef.current) {
      return;
    }
    const savedPath = typeof createTrainParams.tensorBoardDataPath === "string"
      ? createTrainParams.tensorBoardDataPath.trim()
      : undefined;
    const hasPath = Boolean(savedPath);
    appForm.setFieldsValue({
      needTensorBoard: hasPath,
      tensorBoardDataPath: hasPath ? savedPath : undefined,
    });
    resubmitTensorBoardAppliedRef.current = true;
  }, [appForm, createTrainParams]);

  // 如果用户来自「再次提交」或历史记录，提前解析镜像相关的偏好设置
  const resubmitImagePreference = useMemo(() => {
    if (!createTrainParams) {
      return undefined;
    }

    if (createTrainParams.remoteImageUrl) {
      const draft: ImageSourceDraft = {
        image: createTrainParams.remoteImageUrl,
        usePrivateImage: Boolean(createTrainParams.privateImageRepositoryCredentials),
        remoteUsername: createTrainParams.privateImageRepositoryCredentials?.userName,
        remotePassword: createTrainParams.privateImageRepositoryCredentials?.password,
      };
      return {
        source: "remote" as const,
        draft,
      };
    }

    if (createTrainParams.image !== undefined && createTrainParams.image !== null) {
      const draft: ImageSourceDraft = {
        image: String(createTrainParams.image),
      };
      return {
        source: createTrainParams.isImagePrivate === false ? "public" as const : "mine" as const,
        draft,
      };
    }

    return undefined;
  }, [createTrainParams]);

  useEffect(() => {
    if (!createTrainParams) {
      resubmitCascaderAppliedRef.current = {
        datasets: false,
        algorithms: false,
        models: false,
      };
      resubmitTensorBoardAppliedRef.current = false;
    }
  }, [createTrainParams]);

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
  const resubmitCommandKeyRef = useRef<string | undefined>();
  const resubmitCommandUsedRef = useRef<boolean>(false);
  const resubmitCommandLockedRef = useRef<boolean>(false);

  // 按镜像来源推导默认运行命令，方便表单自动补齐
  const currentCommandDefault = useMemo(() => {
    const trimmedResubmitCommand = createTrainParams?.command?.trim();
    const resubmitSource = resubmitImagePreference?.source;
    const currentCommandKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const resubmitCommandKey = resubmitImagePreference
      ? getCommandCacheKey(resubmitImagePreference.source, resubmitImagePreference.draft.image ?? undefined)
      : undefined;
    resubmitCommandKeyRef.current = resubmitCommandKey;

    if (
      createTrainParams
      && trimmedResubmitCommand
      && resubmitSource === selectedImageSource
      && resubmitCommandKey
      && !hasClusterSwitchedRef.current
      && !resubmitCommandLockedRef.current
      && currentCommandKey === resubmitCommandKey
    ) {
      if (selectedImageSource === "remote") {
        const currentRemote = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        if (currentRemote && createTrainParams.remoteImageUrl === currentRemote) {
          return trimmedResubmitCommand;
        }
      }
      if (selectedImageSource === "mine" || selectedImageSource === "public") {
        const currentLocal = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        const expectedLocal = createTrainParams.image !== undefined && createTrainParams.image !== null
          ? String(createTrainParams.image)
          : undefined;
        if (expectedLocal && currentLocal === expectedLocal) {
          return trimmedResubmitCommand;
        }
      }
    }

    if (selectedImageSource === "mine" || selectedImageSource === "public") {
      const start = selectedImageOption?.startCommand;
      return start && start.trim().length > 0 ? start : undefined;
    }

    return undefined;
  }, [
    createTrainParams,
    resubmitImagePreference,
    selectedImageOption,
    selectedImageSource,
    selectedImageValue,
    normalizedSelectedImageValue,
  ]);

  useEffect(() => {
    // 初始化/重置历史命令状态
    if (!createTrainParams) {
      resubmitCommandKeyRef.current = undefined;
      resubmitCommandUsedRef.current = false;
      resubmitCommandLockedRef.current = false;
      return;
    }
    resubmitCommandUsedRef.current = false;
    resubmitCommandLockedRef.current = false;
  }, [createTrainParams]);

  useEffect(() => {
    // 当已使用过历史命令且镜像 key 改变时，锁定历史命令，后续使用镜像默认值
    const currentKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const resubmitKey = resubmitCommandKeyRef.current;
    if (
      resubmitKey
      && resubmitCommandUsedRef.current
      && currentKey
      && currentKey !== resubmitKey
    ) {
      resubmitCommandLockedRef.current = true;
    }
  }, [normalizedSelectedImageValue, selectedImageSource]);

  useEffect(() => {
    // 当镜像来源或选项发生变化时，将缓存中的默认/自定义命令同步到表单
    if (isClusterResettingRef.current) {
      return;
    }
    const currentKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const cache = commandCacheRef.current;
    const entry = cache[currentKey] ?? (cache[currentKey] = { default: currentCommandDefault });

    if (entry.default !== currentCommandDefault) {
      entry.default = currentCommandDefault;
      if (entry.custom === undefined) {
        const targetValue = entry.default ?? "";
        if ((appForm.getFieldValue("command") ?? "") !== targetValue) {
          isSyncingCommandRef.current = true;
          appForm.setFieldsValue({ command: targetValue });
        }
        return;
      }
    }

    const targetValue = entry.custom ?? entry.default ?? "";
    if ((appForm.getFieldValue("command") ?? "") !== targetValue) {
      isSyncingCommandRef.current = true;
      appForm.setFieldsValue({ command: targetValue });
    }

    const resubmitKey = resubmitCommandKeyRef.current;
    if (
      resubmitKey
      && currentKey === resubmitKey
      && currentCommandDefault === (createTrainParams?.command?.trim() ?? undefined)
    ) {
      resubmitCommandUsedRef.current = true;
    }
  }, [appForm, currentCommandDefault, normalizedSelectedImageValue, selectedImageSource]);

  useEffect(() => {
    // 根据当前表单值更新缓存的自定义命令，用户修改后在其他镜像间切换仍能保留
    const currentKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const cache = commandCacheRef.current;
    const entry = cache[currentKey] ?? (cache[currentKey] = { default: currentCommandDefault });

    if (entry.default !== currentCommandDefault) {
      entry.default = currentCommandDefault;
    }

    const defaultValue = entry.default ?? "";

    if (isSyncingCommandRef.current) {
      if (commandValue === defaultValue) {
        entry.custom = undefined;
        isSyncingCommandRef.current = false;
      }
      return;
    }

    if (commandValue === defaultValue || (entry.default === undefined && commandValue === "")) {
      entry.custom = undefined;
    } else {
      entry.custom = commandValue;
    }
  }, [commandValue, currentCommandDefault, normalizedSelectedImageValue, selectedImageSource]);
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

  const isAscend910 = selectedQueueOption?.type === "gpu"
    && selectedQueueOption?.gpuType === "huawei.com/Ascend910";
  useEffect(() => {
    setFrameworkOptions(isAscend910 ? [...DEFAULT_FRAMEWORKS, "mindspore"] : [...DEFAULT_FRAMEWORKS]);
  }, [isAscend910]);

  useEffect(() => {
    if (!frameworkOptions.includes(selectedFramework)) {
      resourceForm.setFieldValue("framework", frameworkOptions[0] ?? "single");
    }
  }, [frameworkOptions, resourceForm, selectedFramework]);

  useEffect(() => {
    const perNodeUnits = Math.max(1, Number(nodeUnitCount ?? 1));
    const psNodes = Math.max(0, Number(psNodeCount ?? 0));
    const workerNodes = Math.max(1, Number(workerNodeCount ?? 1));
    const distributedNodes = Math.max(2, Number(distributedNodeCount ?? 2));

    let nodeMultiplier = 1;
    if (selectedFramework === "tensorflow") {
      nodeMultiplier = Math.max(1, psNodes + workerNodes);
    } else if (["pytorch", "mpi", "mindspore"].includes(selectedFramework)) {
      nodeMultiplier = distributedNodes;
    }

    const totalUnits = perNodeUnits * nodeMultiplier;
    const updates: Partial<ResourceFormValues> = {};
    if (activeResourceTab === "gpu") {
      if (resourceForm.getFieldValue("gpuCores") !== totalUnits) {
        updates.gpuCores = totalUnits;
      }
      if (resourceForm.getFieldValue("cpuCores") !== undefined) {
        updates.cpuCores = undefined;
      }
    } else {
      if (resourceForm.getFieldValue("cpuCores") !== totalUnits) {
        updates.cpuCores = totalUnits;
      }
      if (resourceForm.getFieldValue("gpuCores") !== undefined) {
        updates.gpuCores = undefined;
      }
    }

    if (Object.keys(updates).length) {
      resourceForm.setFieldsValue(updates);
    }
  }, [
    activeResourceTab,
    distributedNodeCount,
    nodeUnitCount,
    psNodeCount,
    resourceForm,
    selectedFramework,
    workerNodeCount,
  ]);

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
    ? (selectedGpuCount > 0 ? selectedGpuCount : "-")
    : "-";

  const displayedCpu = (() => {
    if (activeResourceTab === "gpu") {
      if (selectedGpuCount > 0 && cpuPerUnit) {
        const totalCpu = cpuPerUnit * selectedGpuCount;
        return Number.isInteger(totalCpu) ? totalCpu : totalCpu.toFixed(2);
      }
      return "-";
    }
    return selectedCpuCount > 0 ? selectedCpuCount : "-";
  })();

  const displayedMemory = (() => {
    const units = activeResourceTab === "gpu" ? selectedGpuCount : selectedCpuCount;
    if (units <= 0) {
      return "-";
    }
    if (memoryPerUnitMb) {
      return formatSize(memoryPerUnitMb * units, ["MB", "GB", "TB"]);
    }
    return memoryPerUnitText;
  })();

  const unitsForQuery = activeResourceTab === "gpu" ? selectedGpuCount : selectedCpuCount;
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
    gpu: selectedGpuCount,
    cpusAlloc: selectedCpuCount,
    memMb: memMbForQuery,
    qos: priority,
    timeSeconds: timeSecondsForPrice,
  }, {
    enabled: jobPriceQueryEnabled,
  });

  const formattedHourlyPrice = jobOneHourPrice == null ? "-" : `${jobOneHourPrice.toFixed(2)} ${t(p("yuan"))}`;


  // 结合账户配置和全局配置生成可点击的集群按钮列表
  // 根据账户授权过滤可用集群，并映射出按钮需要的展示文案
  const clusterOptions = useMemo(() => {
    const allowedClusters = new Set<string>(selectedAccount ? (accountClusterMap[selectedAccount] ?? []) : []);
    // 当前用户关联可用账户下的所有可用在线集群
    const associateClusterIds = new Set<string>(currentAvailableClusterIds ?? []);
    // 获取AI可用在线集群
    const activatedAvailableClusters = CLUSTERS.filter((c) => {
      return associateClusterIds.has(c.id);
    });
    // 只展示：(系统在线的集群) 且 (用户至少有一个账户能访问该集群)
    return activatedAvailableClusters.map((cluster) => ({
      id: cluster.id,
      name: getI18nConfigCurrentText(cluster.name, languageId),
      disabled: !selectedAccount || !allowedClusters.has(cluster.id),
    }));
  }, [CLUSTERS, accountClusterMap, currentAvailableClusterIds, languageId, selectedAccount]);

  useEffect(() => {
    // 再次提交时回填账户与集群，避免默认值覆盖历史配置
    if (!createTrainParams) {
      resubmitResourceAppliedRef.current = false;
      return;
    }
    if (resubmitResourceAppliedRef.current) {
      return;
    }

    const targetAccount = createTrainParams.account;
    const targetCluster = createTrainParams.clusterId;

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
  }, [accountOptions, clusterOptions, createTrainParams, resourceForm]);

  useEffect(() => {
    // 再次提交时回填队列、优先级与核心/加速卡数以及运行时长
    if (!createTrainParams) {
      resubmitQueueAppliedRef.current = false;
      return;
    }
    if (!queueRowById.size || resubmitQueueAppliedRef.current) {
      return;
    }

    if (!selectedCluster) {
      return;
    }

    if (createTrainParams.clusterId && selectedCluster && createTrainParams.clusterId !== selectedCluster) {
      return;
    }

    const targetQueueId = createTrainParams.partition;
    const targetQueue = targetQueueId ? queueRowById.get(targetQueueId) : undefined;

    const nextTab: QueueKind = targetQueue?.type
      ?? ((createTrainParams.gpuCount ?? 0) > 0 ? "gpu" : "cpu");

    if (activeResourceTab !== nextTab) {
      setActiveResourceTab(nextTab);
    }

    let maxTimeValue: number | undefined;
    if (createTrainParams.maxTime !== undefined && createTrainParams.maxTime !== null) {
      const minutes = Math.max(1, createTrainParams.maxTime);
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
    const savedFramework = (createTrainParams.framework ?? "single") as TrainFramework;
    updates.framework = savedFramework;

    const normalizedNodeCount = Math.max(1, createTrainParams.nodeCount ?? 1);
    let derivedNodeMultiplier = normalizedNodeCount;

    if (savedFramework === "tensorflow") {
      const savedPsNodes = Math.max(0, createTrainParams.psNodes ?? 0);
      const savedWorkerNodes = Math.max(1, createTrainParams.workerNodes ?? 1);
      updates.psNodeCount = savedPsNodes;
      updates.workerNodeCount = savedWorkerNodes;
      derivedNodeMultiplier = Math.max(1, savedPsNodes + savedWorkerNodes);
    } else if (["pytorch", "mpi", "mindspore"].includes(savedFramework)) {
      const savedDistributedNodes = Math.max(2, normalizedNodeCount);
      updates.distributedNodeCount = savedDistributedNodes;
      derivedNodeMultiplier = savedDistributedNodes;
    } else {
      derivedNodeMultiplier = normalizedNodeCount;
    }

    const qosList = targetQueue.qosOptions ?? [];
    if (createTrainParams.qos) {
      if (qosList.includes(createTrainParams.qos)) {
        updates.priority = createTrainParams.qos;
      } else {
        updates.priority = undefined;
      }
    } else {
      updates.priority = undefined;
    }

    if (maxTimeValue !== undefined) {
      updates.maxTime = maxTimeValue;
    }

    const perNodeUnitsRaw = targetQueue.type === "gpu"
      ? createTrainParams.gpuCount
      : createTrainParams.coreCount;
    let nodeUnits = Number(perNodeUnitsRaw ?? 0);
    if (!Number.isFinite(nodeUnits) || nodeUnits <= 0) {
      const fallbackTotalUnits = Number(perNodeUnitsRaw ?? 1);
      nodeUnits = Math.max(
        1,
        Math.floor(fallbackTotalUnits / Math.max(1, derivedNodeMultiplier)),
      );
    }
    updates.nodeUnitCount = Math.max(1, nodeUnits);

    if (Object.keys(updates).length > 0) {
      resourceForm.setFieldsValue(updates);
    }

    resubmitQueueAppliedRef.current = true;
    resubmitQueueEverAppliedRef.current = true;
  }, [
    activeResourceTab,
    cpuRows,
    createTrainParams,
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

    if (createTrainParams && !resubmitQueueAppliedRef.current) {
      return;
    }

    const currentSelection = currentQueueOptions.find(
      (option) => option.id === selectedQueueKey,
    );
    if (!currentSelection) {
      const savedQueueId = createTrainParams?.partition;
      if (createTrainParams && selectedQueueKey === savedQueueId) {
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
  }, [createTrainParams, currentQueueOptions, selectedQueueKey]);

  // 若用户尚未选择账户，自动填入第一条有效账户
  useEffect(() => {
    if (createTrainParams && !resubmitResourceAppliedRef.current) {
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
  }, [accountOptions, createTrainParams, resourceForm, selectedAccount]);

  // 选中账户发生变化时，若当前集群不可用则自动切换到第一个可用集群
  useEffect(() => {
    if (createTrainParams && !resubmitResourceAppliedRef.current) {
      return;
    }
    const currentAccount = selectedAccount ?? resourceForm.getFieldValue("account");
    const currentCluster = selectedCluster ?? resourceForm.getFieldValue("cluster");

    const availableClusters = currentAccount ? (accountClusterMap[currentAccount] ?? []) : [];
    const firstEnabledCluster = clusterOptions.find((option) => !option.disabled)?.id;

    if (!currentAccount || !availableClusters.length) {
      if (currentCluster !== undefined) {
        resourceForm.setFieldValue("cluster", undefined);
      }
      return;
    }
    if (!currentCluster || !availableClusters.includes(currentCluster) || !firstEnabledCluster) {
      resourceForm.setFieldValue("cluster", firstEnabledCluster);
    }
  }, [
    accountClusterMap,
    clusterOptions,
    createTrainParams,
    currentAvailableClusterIds,
    resourceForm,
    selectedAccount,
    selectedCluster,
  ]);

  // 与标签状态保持同步，确保 queue 字段符合 GPU / CPU 的切换
  useEffect(() => {
    resourceForm.setFieldValue("queue", activeResourceTab);
  }, [resourceForm, activeResourceTab]);

  useEffect(() => {
    if (activeResourceTab !== "gpu") {
      return;
    }
    if (typeof gpuUnitLimit !== "number" || gpuUnitLimit <= 0) {
      return;
    }
    const currentValue = resourceForm.getFieldValue("nodeUnitCount");
    if (typeof currentValue === "number" && currentValue > gpuUnitLimit) {
      resourceForm.setFieldValue("nodeUnitCount", gpuUnitLimit);
    }
  }, [activeResourceTab, gpuUnitLimit, resourceForm]);

  // 切换镜像来源时恢复已保存的选项
  useEffect(() => {
    const draft = imageSourceDraftsRef.current[selectedImageSource] ?? {};

    if (selectedImageSource === "remote") {
      appForm.setFieldsValue({
        image: draft.image,
        command: draft.command,
        usePrivateImage: draft.usePrivateImage ?? false,
        remoteUsername: draft.remoteUsername,
        remotePassword: draft.remotePassword,
      });
    } else {
      appForm.setFieldsValue({
        image: draft.image,
        command: draft.command,
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

    if (createTrainParams) {
      if (!resubmitQueueAppliedRef.current) {
        return;
      }
      const savedPriority = createTrainParams.qos;
      const savedQueueId = createTrainParams.partition;

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
  }, [createTrainParams, resourceForm, selectedQueueKey, selectedQueueOption]);

  // ----- 提交逻辑：校验 + 组装 payload + 调用接口 -----
  // 聚合验证三个表单区域，确保必填项完整后续再接入真实提交
  const handleSubmit = async () => {
    sanitizeAppFormValues();
    let baseValues: BaseFormValues;
    let resourceValues: ResourceFormValues;
    let appValues: TrainAppFormValues;
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
      console.error("Failed to validate create train job form:", error);
      return;
    }

    try {
      const {
        account,
        cluster,
        priority: qos,
        cpuCores,
        maxTime,
        nodeUnitCount: nodeUnitCountValue,
        psNodeCount: psNodeCountValue,
        workerNodeCount: workerNodeCountValue,
        distributedNodeCount: distributedNodeCountValue,
        framework: frameworkValueFromForm,
      } = resourceValues;
      const partition = selectedQueueKey;
      const queueOption = selectedQueueOption;

      if (!cluster || !account || !partition || !queueOption) {
        message.error(t(p("selectValidAccountClusterQueue")));
        return;
      }

      const isGpuQueue = queueOption.type === "gpu";
      const frameworkValue = frameworkValueFromForm ?? selectedFramework ?? "single";

      const perNodeUnitsInput = Number(nodeUnitCountValue ?? 0);
      if (!Number.isFinite(perNodeUnitsInput) || perNodeUnitsInput <= 0) {
        message.error(t(p("invalidResourceConfig")));
        return;
      }
      const perNodeUnits = Math.max(1, perNodeUnitsInput);

      const normalizedPsNodes = Math.max(0, Number(psNodeCountValue ?? 0));
      const normalizedWorkerNodes = Math.max(1, Number(workerNodeCountValue ?? 1));
      const normalizedDistributedNodes = Math.max(2, Number(distributedNodeCountValue ?? 2));

      let nodeCount = 1;
      if (frameworkValue === "tensorflow") {
        nodeCount = Math.max(1, normalizedPsNodes + normalizedWorkerNodes);
      } else if (["pytorch", "mpi", "mindspore"].includes(frameworkValue)) {
        nodeCount = Math.max(1, normalizedDistributedNodes);
      }

      const perNodeGpuCount = isGpuQueue ? perNodeUnits : 0;
      const perNodeCpuCount = isGpuQueue
        ? (() => {
          if (cpuPerUnit && cpuPerUnit > 0) {
            return Math.max(1, Math.round(cpuPerUnit * perNodeGpuCount));
          }
          const totalCpuFromForm = typeof cpuCores === "number" ? cpuCores : undefined;
          if (totalCpuFromForm && totalCpuFromForm > 0) {
            return Math.max(1, Math.round(totalCpuFromForm / Math.max(1, nodeCount)));
          }
          return 1;
        })()
        : perNodeUnits;

      const totalGpuUnits = perNodeGpuCount * nodeCount;
      const totalCpuUnits = perNodeCpuCount * nodeCount;

      const unitCount = isGpuQueue ? totalGpuUnits : totalCpuUnits;
      if (unitCount <= 0) {
        message.error(t(p("invalidResourceConfig")));
        return;
      }

      if (totalCpuUnits <= 0) {
        message.error(t(p("invalidResourceConfig")));
        return;
      }

      const memoryMb = memoryPerUnitMb
        ? Math.max(0, Math.round(memoryPerUnitMb * unitCount))
        : undefined;

      const maxTimeMinutes = Math.max(1, Math.round(convertDurationToHours(maxTime, maxTimeUnit) * 60));

      // 将级联选择值映射回后端所需的 {id, isPrivate} 列表
      const algorithmLookup = buildVersionLookup(algorithms?.personal as VersionGroup[] | undefined,
        algorithms?.public as VersionGroup[] | undefined);
      const datasetLookup = buildVersionLookup(datasets?.personal as VersionGroup[] | undefined,
        datasets?.public as VersionGroup[] | undefined);
      const modelLookup = buildVersionLookup(models?.personal as VersionGroup[] | undefined,
        models?.public as VersionGroup[] | undefined);

      const algorithmsPayload = toIdPrivateList(appValues.algorithms, algorithmLookup);
      const datasetsPayload = toIdPrivateList(appValues.datasets, datasetLookup);
      const modelsPayload = toIdPrivateList(appValues.models, modelLookup);

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

      const envVariablesPayload = (appValues.envVariables ?? [])
        .filter((env) => env?.key && env?.value)
        .map((env) => ({
          key: env.key.trim(),
          value: env.value.trim(),
        }));

      let imageId: number | undefined;
      let remoteImageUrl: string | undefined;
      let isImagePrivate: boolean | undefined;
      let localImageName: string | undefined;

      // 不同镜像来源需要组装不同字段，提前归类成统一 payload
      if (selectedImageSource === "mine" || selectedImageSource === "public") {
        if (normalizedSelectedImageValue) {
          const parsed = Number(normalizedSelectedImageValue);
          if (!Number.isNaN(parsed)) {
            imageId = parsed;
          }
        }
        isImagePrivate = selectedImageSource === "mine";
        localImageName = selectedImageOption?.label;
      } else if (selectedImageSource === "remote") {
        remoteImageUrl = appValues.image?.trim();
        if (!remoteImageUrl) {
          message.error(t(p("remoteImageRequired")));
          return;
        }
      }

      const trimmedCommand = appValues.command?.trim();
      const startCommandValue = trimmedCommand ? trimmedCommand : undefined;

      // 所有校验通过后，调用后端接口创建训练
      await createTrainJobMutation.mutateAsync({
        clusterId: cluster,
        trainJobName: baseValues.appJobName,
        algorithms: algorithmsPayload,
        image: imageId,
        isImagePrivate,
        localImageName,
        remoteImageUrl,
        framework: frameworkValue === "single" ? undefined : frameworkValue,
        datasets: datasetsPayload,
        models: modelsPayload,
        mountPoints: mountPointsPayload.length ? mountPointsPayload : undefined,
        account,
        partition,
        qos,
        coreCount: perNodeCpuCount,
        nodeCount,
        gpuCount: isGpuQueue ? perNodeGpuCount : undefined,
        memory: memoryMb,
        maxTime: maxTimeMinutes,
        command: startCommandValue ?? "",
        gpuType: queueOption.type === "gpu" ? queueOption.gpuType : undefined,
        envVariables: envVariablesPayload.length ? envVariablesPayload : undefined,
        psNodes: frameworkValue === "tensorflow" ? normalizedPsNodes : undefined,
        workerNodes: frameworkValue === "tensorflow" ? normalizedWorkerNodes : undefined,
        tensorBoardDataPath: appValues.needTensorBoard ? appValues.tensorBoardDataPath : undefined,
        ...appValues.usePrivateImage ? {
          privateImageRepositoryCredentials:{
            userName: appValues.remoteUsername ?? "",
            password: appValues.remotePassword ?? "",
          },
        } : {},
      });
    } catch (error) {
      console.error("Failed to submit create train job form:", error);
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
                {t(pTrain("createTrainTitle"))}
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
          queueNodesInfo={queueNodesInfo}
          qosOptions={qosOptions}
          maxTimeUnit={maxTimeUnit}
          onMaxTimeUnitChange={handleMaxTimeUnitChange}
          maxJobRunningTimeHours={maxJobRunningTimeHours}
          convertDurationToHours={convertDurationToHours}
          frameworkOptions={frameworkOptions}
          gpuUnitLimit={gpuUnitLimit}
          isResubmit={Boolean(createTrainParams)}
        />

        <TrainConfigSection
          form={appForm}
          imageSourceTabs={imageSourceTabs}
          selectedImageSource={selectedImageSource}
          onImageSourceChange={handleImageSourceChange}
          imagePlaceholder={imagePlaceholder}
          imageOptions={imageOptionsForSource}
          isImagesLoading={isImagesLoading}
          selectedImageOption={selectedImageOption}
          usePrivateRemoteImage={usePrivateRemoteImage}
          currentCommandDefault={currentCommandDefault}
          datasetCategories={datasetCategories}
          algorithmCategories={algorithmCategories}
          modelCategories={modelCategories}
          isDatasetsLoading={isDatasetsLoading}
          isAlgorithmsLoading={isAlgorithmsLoading}
          isModelsLoading={isModelsLoading}
          selectedCluster={selectedCluster}
          displayRender={renderCascaderLabels}
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
          <a onClick={() => { window.open(join(misPath, "/user/partitions"), "_blank", "noopener"); }}>
            <FooterStatValue $isPrimaryColor>{t(p("chargeStandard"))}</FooterStatValue>
          </a>
        </FooterStats>
        <FooterActions>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={createTrainJobMutation.isPending}
          >
            {t(p("submit"))}
          </Button>
        </FooterActions>
      </FixedFooter>
    </>
  );
};
