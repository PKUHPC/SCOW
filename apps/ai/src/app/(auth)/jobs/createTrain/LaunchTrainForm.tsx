"use client";

import type { ColumnsType } from "antd/es/table";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelector.shared";
import type { TemplateFormData, TrainTemplateFormData } from "src/server/trpc/route/jobs/templates";

import { FixedFooter, FooterActions } from "@scow/lib-web/build/components/job/Footer";
import { JobSideInfo } from "@scow/lib-web/build/components/job/JobSideInfo";
import {
  BorderlessCard,
  HeaderRow,
  HeaderTitle,
  PaddedCard,
} from "@scow/lib-web/build/components/styledAntdCom/DualTitleCard";
import { SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import {
  JobContainer,
  JobMainContent,
  JobPageLayout,
  JobSidePanel,
  JobSidePanelInner,
} from "@scow/lib-web/build/layouts/base/JobContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Space, Typography } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { join } from "path";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { SaveAsTemplateModal } from "src/app/(auth)/jobs/components/SaveAsTemplateModal";
import { TemplateListModal } from "src/app/(auth)/jobs/components/TemplateListModal";
import { UnavailableParam, UnavailableParamsModal } from "src/app/(auth)/jobs/components/UnavailableParamsModal";
import { SidePanelGroupWrapper } from "src/app/(auth)/jobs/LaunchJobForm.styles";
import { MAX_TIME_PRESETS } from "src/app/(auth)/jobs/maxTime";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ImageType, Status } from "src/models/Image";
import { JobType } from "src/models/Job";
import { type FrameworkType, TrainJobInput } from "src/server/trpc/route/jobs/jobs";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { useTheme } from "styled-components";

import type {
  BaseFormValues,
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
  buildEnvPayload,
  buildResubmitResourceSelections,
  buildSelectionPathLookup,
  buildUnavailableParams,
  buildVersionLookup,
  cleanFormData,
  convertDurationToHours,
  deriveQueueStats,
  getCommandCacheKey,
  initBuiltinEnvVariables,
  mapQueuesToRows,
  mergeResubmitEnvVariables,
  normalizeEnvVariables,
  normalizeMountPoints,
  renderCascaderLabels,
  sanitizeFormMountAndEnvValues,
  toIdPrivateList,
} from "../LaunchJobForm.utils";
import { PublicImageOption } from "../PublicImageOption";
import { BaseInfoSection } from "./components/BaseInfoSection";
import { ResourceConfigSection } from "./components/ResourceConfigSection";
import { TrainConfigSection } from "./components/TrainConfigSection";

// ======================= 类型定义 =======================
interface Props {
  createTrainParams?: TrainJobInput;
  misPath: string;
}

const p = prefix("app.jobs.launchAppForm.");
const pTrain = prefix("app.jobs.launchTrainForm.");
const pPublicOption = prefix("app.jobs.publicImageOption.");
type LaunchTrainFormKey = Parameters<typeof p>[0];
type ImageSourceLabelKey = Extract<LaunchTrainFormKey, `imageSourceTabs.${string}`>;
type ImagePlaceholderKey = Extract<LaunchTrainFormKey, `imagePlaceholders.${string}`>;

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

const DEFAULT_FRAMEWORKS: TrainFramework[] = ["single", "tensorflow", "pytorch", "mpi"];

type TranslateFn = ReturnType<typeof useI18nTranslateToString>;

// GPU 队列表格列定义，包含显卡信息与资源情况
const buildGpuColumns = (t: TranslateFn): ColumnsType<GPUQueueRow> => [
  {
    title: t(p("gpuColumns.queue")),
    dataIndex: "queue",
    key: "queue",
    width: "14%",
  },
  {
    title: t(p("gpuColumns.accelerator")),
    dataIndex: "accelerator",
    key: "accelerator",
    width: "28%",
    render: (_: unknown, record: GPUQueueRow) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>{record.accelerator}</Typography.Text>
        {record.acceleratorDetail ? <Typography.Text>{record.acceleratorDetail}</Typography.Text> : null}
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
    width: "18%",
    render: (value: string) => value || "-",
  },
];

// CPU 队列列定义，关注核数与内存分配
const buildCpuColumns = (t: TranslateFn): ColumnsType<CPUQueueRow> => [
  {
    title: t(p("cpuColumns.queue")),
    dataIndex: "queue",
    key: "queue",
    width: "14%",
  },
  {
    title: t(p("cpuColumns.cpuModel")),
    dataIndex: "cpuModel",
    key: "cpuModel",
    width: "30%",
    render: (_: unknown, record: CPUQueueRow) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>{record.cpuModel}</Typography.Text>
        {record.cpuDetail ? <Typography.Text type="secondary">{record.cpuDetail}</Typography.Text> : null}
      </Space>
    ),
  },
  {
    title: t(p("cpuColumns.capacity")),
    dataIndex: "capacity",
    key: "capacity",
    width: "28%",
  },
  {
    title: t(p("cpuColumns.memoryPerCore")),
    dataIndex: "memoryPerCore",
    key: "memoryPerCore",
    width: "28%",
    render: (text?: string) => text ?? "-",
  },
];

// ======================= 组件实现 =======================
// 主表单组件，协调基础信息、资源配置与应用配置三个分区，并负责数据提交
export const LaunchTrainForm = ({ createTrainParams, misPath }: Props) => {
  const { currentLanguage } = useI18n();
  const languageId = currentLanguage.id;
  const t = useI18nTranslateToString();
  const theme = useTheme();
  const { publicConfig, scowClusterConfigs, currentAvailableClusterIds } = usePublicConfig();
  const { CLUSTERS } = publicConfig;
  const router = useRouter();

  const { message } = App.useApp();
  // ======================= 状态与引用 =======================
  const [baseForm] = Form.useForm<BaseFormValues>();
  const [resourceForm] = Form.useForm<ResourceFormValues>();
  const [appForm] = Form.useForm<TrainAppFormValues>();

  const hasInitializedBuiltinEnvVariablesRef = useRef(false);
  useEffect(() => {
    if (hasInitializedBuiltinEnvVariablesRef.current) {
      return;
    }

    initBuiltinEnvVariables(appForm, Boolean(createTrainParams));
    hasInitializedBuiltinEnvVariablesRef.current = true;
  }, [appForm, createTrainParams]);

  const trpcUtils = trpc.useUtils();
  const gpuColumns = useMemo(() => buildGpuColumns(t), [languageId, t]);
  const cpuColumns = useMemo(() => buildCpuColumns(t), [languageId, t]);
  const imageSourceTabs = useMemo(
    () =>
      IMAGE_SOURCE_TAB_CONFIG.map((tab) => ({
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
  const initialJobName = useMemo(() => `train-${dayjs().format("YYMMDD-HHmmss")}`.toLowerCase(), []);
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
  const isApplyingTemplateRef = useRef(false);
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
  const [selectedPresetUnit, setSelectedPresetUnit] = useState<MaxTimeUnit | undefined>("min");

  // createTrainParams is used directly by resubmit effects (no template merge)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [templateSnapshot, setTemplateSnapshot] = useState<TrainTemplateFormData | null>(null);
  const [unavailableParamsModal, setUnavailableParamsModal] = useState<{
    params: UnavailableParam[];
    applyFn: () => void | Promise<void>;
  } | null>(null);

  // 账户集群关系
  const { data: appAvailableAccountsAndClusters } = trpc.jobs.listAppAvailableAccountsAndClusters.useQuery({});

  const accountClusterMap = appAvailableAccountsAndClusters?.accountClusters ?? {};

  // 账户下拉选项根据 cluster 关联关系动态生成
  const accountOptions = useMemo(
    () =>
      Object.keys(accountClusterMap).map((account) => ({
        label: account,
        value: account,
      })),
    [accountClusterMap],
  );

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
  const selectedMaxTime = Form.useWatch<number | undefined>("maxTime", resourceForm);
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
      defaults.distributedNodeCount = 1;
    }
    if (Object.keys(defaults).length) {
      resourceForm.setFieldsValue(defaults);
    }
  }, [resourceForm]);

  const { data: userHomeDir } = trpc.file.getHomeDir.useQuery(
    { clusterId: selectedCluster! },
    { enabled: !!selectedCluster },
  );

  const { data: accountInfo } = trpc.account.getAccountInfo.useQuery(
    { accountName: selectedAccount! },
    {
      enabled: Boolean(publicConfig.MIS_DEPLOYED && selectedAccount),
      retry: false,
    },
  );

  // ----------- 服务请求与变更提示 -----------
  // 提交训练作业的 RPC 请求，集中处理成功跳转和常见错误提示
  const createTrainJobMutation = trpc.jobs.trainJob.useMutation({
    onSuccess: () => {
      message.success(t(pTrain("submitTrainSuccessfully")));
      router.push("/jobs/jobList");
    },
    onError: (error) => {
      const detail = error.data?.detailedError;
      if (detail?.type === "path_validation_failed") {
        message.error(detail.message);
        return;
      }
      if (detail?.type === "image_address_validation_failed") {
        message.error(detail.message);
        return;
      }
      if (detail?.type === "account_user_not_available") {
        message.error(t(p("submitFailedAccountUserUnavailable"), [detail.accountName ?? "", detail.userId ?? ""]));
        return;
      }
      if (detail?.type === "cluster_partition_not_available" && detail.partitionName) {
        const clusterName = CLUSTERS.find((x) => x.id === detail.clusterId)?.name || detail.clusterId;
        const i18nClusterName = getI18nConfigCurrentText(clusterName, languageId);
        message.error(
          t(p("submitFailedAccountPartitionUnavailable"), [
            detail.accountName ?? "",
            i18nClusterName,
            detail.partitionName,
          ]),
        );
        return;
      }
      message.error(`${t(pTrain("submitTrainFailed"))}: ${error.message}`);
    },
  });

  const sanitizeAppFormValues = () => sanitizeFormMountAndEnvValues(appForm);

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
    const applyingTemplate = isApplyingTemplateRef.current;
    if (hadClusterSelection && !applyingTemplate) {
      hasClusterSwitchedRef.current = true;
    }
    const shouldReset = hadClusterSelection;
    isClusterResettingRef.current = true;

    resubmitImageAppliedRef.current = false;
    // 如果已应用过再次提交的队列，则不再重复应用，保持用户后续选择
    if (!resubmitQueueEverAppliedRef.current) {
      resubmitQueueAppliedRef.current = false;
    }
    if (!applyingTemplate) {
      resubmitCascaderAppliedRef.current = {
        datasets: shouldReset,
        algorithms: shouldReset,
        models: shouldReset,
      };
      resubmitMountEnvAppliedRef.current = shouldReset;
    }
    if (shouldReset && !applyingTemplate) {
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
  const maxJobRunningTimeHours = selectedCluster
    ? scowClusterConfigs[selectedCluster]?.ai?.train?.maxRunningTimeHours
    : undefined;

  // 根据选中的账户与集群拉取对应的队列与资源详情
  // ----- 数据拉取：根据选中账户/集群实时刷新依赖数据 -----
  const { data: queueData, isLoading: getAvailablePartitionIsLoading } = trpc.config.getAvailablePartitions.useQuery(
    { accountName: selectedAccount!, clusterId: selectedCluster! },
    { enabled: !!selectedAccount && !!selectedCluster },
  );

  const { data: queueNodesInfo } = trpc.dashboard.getClusterNodesInfo.useQuery(
    { clusterId: selectedCluster! },
    { enabled: !!queueData && !!selectedCluster },
  );

  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery(
    {
      isPublic: selectedImageSource === "public" ? parseBooleanParam(true) : parseBooleanParam(false),
      clusterId: selectedCluster,
      withExternal: "true",
      types: ImageType.TRAIN,
    },
    {
      enabled: !!selectedCluster && (selectedImageSource === "public" || selectedImageSource === "mine"),
    },
  );

  const { data: algorithms, isLoading: isAlgorithmsLoading } = trpc.algorithm.getAllAlgorithmVersions.useQuery(
    {
      clusterId: selectedCluster,
    },
    {
      enabled: !!selectedCluster,
    },
  );

  const { data: datasets, isLoading: isDatasetsLoading } = trpc.dataset.getAllDatasetVersions.useQuery(
    {
      clusterId: selectedCluster,
    },
    {
      enabled: !!selectedCluster,
    },
  );

  const { data: models, isLoading: isModelsLoading } = trpc.model.getAllModelVersions.useQuery(
    {
      clusterId: selectedCluster,
    },
    {
      enabled: !!selectedCluster,
    },
  );

  const buildOwnerText = (isPlatformOwned: boolean, ownerName?: string, ownerId?: string) => {
    if (isPlatformOwned) return t(pPublicOption("sharedBy"), [t(pPublicOption("platformName"))]);
    const ownerDisplay = ownerName ?? ownerId ?? "-";
    return t(pPublicOption("sharedBy"), [ownerDisplay]) + (ownerId ? t(pPublicOption("ownerIdSuffix"), [ownerId]) : "");
  };

  // 构造算法/数据集/模型的级联选项结构
  const algorithmCategories = useMemo<ResourceCategory[]>(() => {
    const personalChildren = (algorithms?.personal ?? [])
      .map((algorithm) => ({
        label: algorithm.name,
        value: algorithm.id,
        description: algorithm.description,
        children: (algorithm.versions ?? []).map((version) => ({
          label: version.versionName,
          value: version.id,
          description: version.versionDescription,
          privatePath: version.privatePath,
          children: [],
        })),
      }))
      .filter((algorithm) => algorithm.children.length > 0);

    const publicChildren = (algorithms?.public ?? [])
      .map((algorithm) => ({
        label: algorithm.name,
        value: algorithm.id,
        description: algorithm.description,
        ownerText: buildOwnerText(algorithm.isPlatformOwned, algorithm.ownerName, algorithm.ownerId),
        children: (algorithm.versions ?? []).map((version) => ({
          label: version.versionName,
          value: version.id,
          description: version.versionDescription,
          children: [],
        })),
      }))
      .filter((algorithm) => algorithm.children.length > 0);

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
    const personalChildren = (datasets?.personal ?? [])
      .map((dataset) => ({
        label: dataset.name,
        value: dataset.id,
        description: dataset.description,
        children: (dataset.versions ?? []).map((version) => ({
          label: version.versionName,
          value: version.id,
          description: version.versionDescription,
          privatePath: version.privatePath,
          children: [],
        })),
      }))
      .filter((dataset) => dataset.children.length > 0);

    const publicChildren = (datasets?.public ?? [])
      .map((dataset) => ({
        label: dataset.name,
        value: dataset.id,
        description: dataset.description,
        ownerText: buildOwnerText(dataset.isPlatformOwned, dataset.ownerName, dataset.ownerId),
        children: (dataset.versions ?? []).map((version) => ({
          label: version.versionName,
          value: version.id,
          description: version.versionDescription,
          children: [],
        })),
      }))
      .filter((dataset) => dataset.children.length > 0);

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
    const personalChildren = (models?.personal ?? [])
      .map((model) => ({
        label: model.name,
        value: model.id,
        description: model.description ?? [model.algorithmName, model.algorithmFramework].filter(Boolean).join(" / "),
        children: (model.versions ?? []).map((version) => ({
          label: version.versionName,
          value: version.id,
          description: version.versionDescription ?? version.algorithmVersion ?? undefined,
          privatePath: version.privatePath,
          children: [],
        })),
      }))
      .filter((model) => model.children.length > 0);

    const publicChildren = (models?.public ?? [])
      .map((model) => ({
        label: model.name,
        value: model.id,
        description: model.description ?? [model.algorithmName, model.algorithmFramework].filter(Boolean).join(" / "),
        ownerText: buildOwnerText(model.isPlatformOwned, model.ownerName, model.ownerId),
        children: (model.versions ?? []).map((version) => ({
          label: version.versionName,
          value: version.id,
          description: version.versionDescription ?? version.algorithmVersion ?? undefined,
          children: [],
        })),
      }))
      .filter((model) => model.children.length > 0);

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
  const datasetSelectionLookup = useMemo(() => buildSelectionPathLookup(datasetCategories), [datasetCategories]);
  const algorithmSelectionLookup = useMemo(() => buildSelectionPathLookup(algorithmCategories), [algorithmCategories]);
  const modelSelectionLookup = useMemo(() => buildSelectionPathLookup(modelCategories), [modelCategories]);

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

    const selections = buildResubmitResourceSelections(createTrainParams.datasets, datasetSelectionLookup);

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

    const selections = buildResubmitResourceSelections(createTrainParams.algorithms, algorithmSelectionLookup);

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

    const selections = buildResubmitResourceSelections(createTrainParams.models, modelSelectionLookup);

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
        const path =
          typeof (item as { path?: string })?.path === "string" ? (item as { path?: string }).path!.trim() : "";
        const target =
          typeof (item as { target?: string })?.target === "string" ? (item as { target?: string }).target!.trim() : "";
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
      envVariables: mergeResubmitEnvVariables(normalizeEnvVariables(envVariablesDraft)),
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
    const savedPath =
      typeof createTrainParams.tensorBoardDataPath === "string"
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
        source: createTrainParams.isImagePrivate === false ? ("public" as const) : ("mine" as const),
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
          displayLabel:
            selectedImageSource === "public" ? (
              <PublicImageOption
                name={image.name}
                tag={image.tag}
                ownerName={image.ownerName}
                ownerId={image.ownerId}
              />
            ) : (
              `${image.name}: ${image.tag}`
            ),
        })) as ImageOption[];
    }
    return [];
  }, [images, selectedImageSource, languageId]);

  // 统一选中值的类型，避免数字 ID 与字符串之间的比较问题
  const normalizedSelectedImageValue =
    selectedImageValue !== undefined && selectedImageValue !== null ? String(selectedImageValue) : undefined;

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
      createTrainParams &&
      trimmedResubmitCommand &&
      resubmitSource === selectedImageSource &&
      resubmitCommandKey &&
      !hasClusterSwitchedRef.current &&
      !resubmitCommandLockedRef.current &&
      currentCommandKey === resubmitCommandKey
    ) {
      if (selectedImageSource === "remote") {
        const currentRemote = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        if (currentRemote && createTrainParams.remoteImageUrl === currentRemote) {
          return trimmedResubmitCommand;
        }
      }
      if (selectedImageSource === "mine" || selectedImageSource === "public") {
        const currentLocal = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        const expectedLocal =
          createTrainParams.image !== undefined && createTrainParams.image !== null
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
    if (resubmitKey && resubmitCommandUsedRef.current && currentKey && currentKey !== resubmitKey) {
      resubmitCommandLockedRef.current = true;
    }
  }, [normalizedSelectedImageValue, selectedImageSource]);

  useEffect(() => {
    // 当镜像来源或选项发生变化时，将缓存中的默认/自定义命令同步到表单
    if (isClusterResettingRef.current || isApplyingTemplateRef.current) {
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
      resubmitKey &&
      currentKey === resubmitKey &&
      currentCommandDefault === (createTrainParams?.command?.trim() ?? undefined)
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
  const currentQueueOptions: QueueRow[] = activeResourceTab === "gpu" ? gpuRows : cpuRows;

  // 结合选中主键获取当前行，用于派生底部统计和表单限制
  const selectedQueueOption = useMemo(
    () => currentQueueOptions.find((option) => option.id === selectedQueueKey),
    [currentQueueOptions, selectedQueueKey],
  );

  const isAscend910 = selectedQueueOption?.type === "gpu" && selectedQueueOption?.gpuType === "huawei.com/Ascend910";
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
    const distributedNodes = Math.max(1, Number(distributedNodeCount ?? 1));

    let nodeMultiplier = 1;
    if (selectedFramework === "tensorflow") {
      nodeMultiplier = Math.max(1, psNodes + workerNodes);
    } else if (["single", "pytorch", "mpi", "mindspore"].includes(selectedFramework)) {
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

  const { cpuPerUnit, memoryPerUnitText, memoryPerUnitMb, qosOptions } = useMemo(
    () => deriveQueueStats(selectedQueueOption),
    [selectedQueueOption],
  );

  const gpuUnitLimit = useMemo(() => {
    if (selectedQueueOption?.type !== "gpu") {
      return undefined;
    }
    const candidates: number[] = [selectedQueueOption.totalUnits];
    if (
      typeof selectedQueueOption.maxAcceleratorsPerPod === "number" &&
      selectedQueueOption.maxAcceleratorsPerPod > 0
    ) {
      candidates.push(selectedQueueOption.maxAcceleratorsPerPod);
    }
    return candidates.length ? Math.min(...candidates) : undefined;
  }, [selectedQueueOption]);

  const displayedGpu = activeResourceTab === "gpu" ? (selectedGpuCount > 0 ? selectedGpuCount : "-") : "-";

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
  const memMbForQuery = hasMemoryPerUnit ? Math.max(0, Math.round(unitsForQuery * (memoryPerUnitMb ?? 0))) : 0;
  const timeSecondsForPrice = 3600;
  // 仅在关键字段齐备、并且能计算出每单位内存时才触发价格查询，避免无效请求
  const jobPriceQueryEnabled =
    Boolean(selectedAccount && selectedCluster && selectedQueueKey && priority) &&
    hasMemoryPerUnit &&
    unitsForQuery > 0;

  const { data: jobOneHourPrice } = trpc.jobs.calculateJobPrice.useQuery(
    {
      cluster: selectedCluster!,
      partition: selectedQueueKey!,
      account: selectedAccount!,
      gpu: selectedGpuCount,
      cpusAlloc: selectedCpuCount,
      memMb: memMbForQuery,
      qos: priority,
      timeSeconds: timeSecondsForPrice,
    },
    {
      enabled: jobPriceQueryEnabled,
    },
  );

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

    const accountAvailable = targetAccount ? accountOptions.some((option) => option.value === targetAccount) : false;

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
    if (isApplyingTemplateRef.current) {
      return;
    }
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

    const nextTab: QueueKind = targetQueue?.type ?? ((createTrainParams.gpuCount ?? 0) > 0 ? "gpu" : "cpu");

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
      setSelectedPresetUnit(
        MAX_TIME_PRESETS.find((preset) => preset.maxTime === value && preset.maxTimeUnit === unit)?.maxTimeUnit,
      );
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
      if (maxTimeValue !== undefined) {
        resourceForm.validateFields(["maxTime"]).catch(() => undefined);
      }
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
    } else if (["single", "pytorch", "mpi", "mindspore"].includes(savedFramework)) {
      const savedDistributedNodes = Math.max(1, normalizedNodeCount);
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

    const perNodeUnitsRaw = targetQueue.type === "gpu" ? createTrainParams.gpuCount : createTrainParams.coreCount;
    let nodeUnits = Number(perNodeUnitsRaw ?? 0);
    if (!Number.isFinite(nodeUnits) || nodeUnits <= 0) {
      const fallbackTotalUnits = Number(perNodeUnitsRaw ?? 1);
      nodeUnits = Math.max(1, Math.floor(fallbackTotalUnits / Math.max(1, derivedNodeMultiplier)));
    }
    updates.nodeUnitCount = Math.max(1, nodeUnits);

    if (Object.keys(updates).length > 0) {
      resourceForm.setFieldsValue(updates);
    }
    if (maxTimeValue !== undefined) {
      resourceForm.validateFields(["maxTime"]).catch(() => undefined);
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
    setSelectedPresetUnit,
    setSelectedQueueKey,
  ]);

  useEffect(() => {
    const maxTimeNotSet = selectedMaxTime === undefined || selectedMaxTime === null;
    if (maxTimeNotSet && !resourceForm.isFieldTouched("maxTime")) {
      resourceForm.setFieldValue("maxTime", 30);
      setSelectedPresetUnit("min");
    }
  }, [resourceForm, selectedMaxTime]);

  // 单位或配置上限变化时触发校验，让用户看到最新提示
  useEffect(() => {
    const currentValue = resourceForm.getFieldValue("maxTime");
    if (currentValue !== undefined && currentValue !== null) {
      resourceForm.validateFields(["maxTime"]);
    }
  }, [maxTimeUnit, maxJobRunningTimeHours, resourceForm, selectedPresetUnit]);

  // 将生成的作业名称与表单字段保持一致，便于 Form 校验
  useEffect(() => {
    baseForm.setFieldsValue({ appJobName: jobName });
  }, [baseForm, jobName]);

  // 队列数据变化时，保持或回退到可用的第一条记录
  useEffect(() => {
    if (isApplyingTemplateRef.current) {
      return;
    }

    if (!currentQueueOptions.length) {
      if (selectedQueueKey !== undefined && getAvailablePartitionIsLoading) {
        return;
      }
      if (selectedQueueKey !== undefined) {
        setSelectedQueueKey(undefined);
      }
      return;
    }

    if (createTrainParams && !resubmitQueueAppliedRef.current) {
      return;
    }

    const currentSelection = currentQueueOptions.find((option) => option.id === selectedQueueKey);
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
  }, [createTrainParams, currentQueueOptions, getAvailablePartitionIsLoading, selectedQueueKey]);

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
    if (isApplyingTemplateRef.current) {
      return;
    }
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

    const remoteMatches =
      !isRemote ||
      (currentImage === desiredImage &&
        Boolean(appForm.getFieldValue("usePrivateImage")) === Boolean(draft.usePrivateImage) &&
        appForm.getFieldValue("remoteUsername") === draft.remoteUsername &&
        appForm.getFieldValue("remotePassword") === draft.remotePassword);

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

    if (currentSource === source && currentImage === desiredImage && remoteMatches) {
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
  }, [appForm, imageOptionsForSource, isImagesLoading, resubmitImagePreference, selectedImageSource]);

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

  const buildTrainTemplateFormData = (): TrainTemplateFormData => {
    const resourceValues = resourceForm.getFieldsValue();
    const appValues = appForm.getFieldsValue();
    const gpuTypeValue = selectedQueueOption?.type === "gpu" ? (selectedQueueOption as GPUQueueRow).gpuType : undefined;
    const perNodeUnits = resourceValues.nodeUnitCount ?? 1;

    const computeNodeCount = () => {
      if (resourceValues.framework === "tensorflow") {
        return (resourceValues.psNodeCount ?? 0) + (resourceValues.workerNodeCount ?? 1);
      }
      if (resourceValues.framework && ["single", "pytorch", "mpi", "mindspore"].includes(resourceValues.framework)) {
        return resourceValues.distributedNodeCount ?? 1;
      }
      return 1;
    };

    return {
      account: selectedAccount ?? undefined,
      partition: selectedQueueKey ?? undefined,
      qos: resourceValues.priority ?? undefined,
      nodeUnitCount: perNodeUnits,
      coreCount: perNodeUnits,
      nodeCount: computeNodeCount(),
      gpuCount: selectedQueueOption?.type === "gpu" ? perNodeUnits : undefined,
      gpuType: gpuTypeValue ?? undefined,
      maxTime: resourceValues.maxTime ?? 60,
      maxTimeUnit: selectedPresetUnit ?? maxTimeUnit,
      isImagePrivate: selectedImageSource === "mine" ? true : selectedImageSource === "public" ? false : undefined,
      image:
        selectedImageSource === "mine" || selectedImageSource === "public"
          ? typeof appValues.image === "string"
            ? Number(appValues.image) || undefined
            : appValues.image
          : undefined,
      localImageName: selectedImageOption?.label,
      remoteImageUrl:
        selectedImageSource === "remote"
          ? typeof appValues.image === "string"
            ? appValues.image
            : undefined
          : undefined,
      framework:
        resourceValues.framework && ["tensorflow", "pytorch", "mindspore", "mpi"].includes(resourceValues.framework)
          ? (resourceValues.framework as FrameworkType)
          : undefined,
      psNodes: resourceValues.psNodeCount ?? undefined,
      workerNodes: resourceValues.workerNodeCount ?? undefined,
      datasets: toIdPrivateList(
        appValues.datasets,
        buildVersionLookup(
          datasets?.personal as VersionGroup[] | undefined,
          datasets?.public as VersionGroup[] | undefined,
        ),
      ),
      models: toIdPrivateList(
        appValues.models,
        buildVersionLookup(
          models?.personal as VersionGroup[] | undefined,
          models?.public as VersionGroup[] | undefined,
        ),
      ),
      algorithms: toIdPrivateList(
        appValues.algorithms,
        buildVersionLookup(
          algorithms?.personal as VersionGroup[] | undefined,
          algorithms?.public as VersionGroup[] | undefined,
        ),
      ),
      mountPoints: (appValues.mountPoints ?? [])
        .filter((m: MountPointField | undefined) => m?.source && m?.target)
        .map((m: MountPointField) => ({ path: m.source, target: m.target })),
      envVariables: (appValues.envVariables ?? []).filter((e: EnvVariableField | undefined) => e?.key),
      command: appValues.command ?? "",
      tensorBoardDataPath: appValues.needTensorBoard ? appValues.tensorBoardDataPath : undefined,
    };
  };

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
      const normalizedDistributedNodes = Math.max(1, Number(distributedNodeCountValue ?? 1));

      let nodeCount = 1;
      if (frameworkValue === "tensorflow") {
        nodeCount = Math.max(1, normalizedPsNodes + normalizedWorkerNodes);
      } else if (["single", "pytorch", "mpi", "mindspore"].includes(frameworkValue)) {
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

      const memoryMb = memoryPerUnitMb ? Math.max(0, Math.round(memoryPerUnitMb * unitCount)) : undefined;

      const maxTimeMinutes = Math.max(
        1,
        Math.round(convertDurationToHours(maxTime, selectedPresetUnit ?? maxTimeUnit) * 60),
      );

      // 将级联选择值映射回后端所需的 {id, isPrivate} 列表
      const algorithmLookup = buildVersionLookup(
        algorithms?.personal as VersionGroup[] | undefined,
        algorithms?.public as VersionGroup[] | undefined,
      );
      const datasetLookup = buildVersionLookup(
        datasets?.personal as VersionGroup[] | undefined,
        datasets?.public as VersionGroup[] | undefined,
      );
      const modelLookup = buildVersionLookup(
        models?.personal as VersionGroup[] | undefined,
        models?.public as VersionGroup[] | undefined,
      );

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

      const envVariablesPayload = buildEnvPayload(appValues.envVariables);

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
        ...(appValues.usePrivateImage
          ? {
              privateImageRepositoryCredentials: {
                userName: appValues.remoteUsername ?? "",
                password: appValues.remotePassword ?? "",
              },
            }
          : {}),
      });
    } catch (error) {
      console.error("Failed to submit create train job form:", error);
    }
  };

  const handleTemplateUse = async (formData: TemplateFormData, templateCluster: string) => {
    const fd = formData;

    const {
      unavailableParams,
      effectiveAccount: finalAccount,
      effectiveCluster: finalCluster,
    } = await buildUnavailableParams({
      fd,
      templateCluster,
      isAccountAvailable: (acc) => accountOptions.some((o) => o.value === acc),
      getAvailableAccounts: () => accountOptions.map((o) => o.value),
      getClustersForAccount: (acc) => accountClusterMap[acc] ?? [],
      selectedAccount,
      selectedCluster,
      selectedQueueKey,
      currentQos: resourceForm.getFieldValue("priority"),
      fetchPartitions: (acc, cluster) =>
        trpcUtils.config.getAvailablePartitions.fetch({ accountName: acc, clusterId: cluster }).catch(() => undefined),
      t: (key) => t(p(key as any)),
      resolveClusterName: (id) => {
        const clusterConfig = CLUSTERS.find((c) => c.id === id);
        return clusterConfig ? getI18nConfigCurrentText(clusterConfig.name, languageId) : id;
      },
    });

    const applyFn = async () => {
      const cleanedFormData = cleanFormData(fd, unavailableParams);
      isApplyingTemplateRef.current = true;
      hasClusterSwitchedRef.current = false;
      commandCacheRef.current = {};

      resourceForm.setFieldsValue({ account: finalAccount, cluster: finalCluster });

      const tplMaxTime = cleanedFormData.maxTime as number | undefined;
      const tplMaxTimeUnit = cleanedFormData.maxTimeUnit as MaxTimeUnit | undefined;
      if (tplMaxTimeUnit) {
        setMaxTimeUnit(tplMaxTimeUnit);
      }
      setSelectedPresetUnit(
        tplMaxTime != null && tplMaxTimeUnit
          ? MAX_TIME_PRESETS.find((preset) => preset.maxTime === tplMaxTime && preset.maxTimeUnit === tplMaxTimeUnit)
              ?.maxTimeUnit
          : undefined,
      );

      const tplPartition = cleanedFormData.partition as string | undefined;
      const tplCoreCount = cleanedFormData.coreCount as number | undefined;
      const tplGpuCount = cleanedFormData.gpuCount as number | undefined;
      const tplQos = cleanedFormData.qos as string | undefined;
      const tplNodeUnitCount = (cleanedFormData.nodeUnitCount as number | undefined) ?? tplGpuCount ?? tplCoreCount;
      let partitionMatched = false;

      if (tplPartition) {
        const partitionsForCluster = await trpcUtils.config.getAvailablePartitions
          .fetch({ accountName: finalAccount, clusterId: finalCluster })
          .catch(() => undefined);
        if (partitionsForCluster) {
          const matched = partitionsForCluster.find((pt) => pt.name === tplPartition);
          if (matched) {
            partitionMatched = true;
            const rows = mapQueuesToRows(partitionsForCluster);
            const allRows = [...rows.gpuRows, ...rows.cpuRows];
            const matchedRow = allRows.find((r) => r.id === tplPartition);
            if (matchedRow) {
              setActiveResourceTab(matchedRow.type);
            }
            setSelectedQueueKey(tplPartition);
            if (tplQos && matched.qos.includes(tplQos)) {
              resourceForm.setFieldsValue({ priority: tplQos });
            }
            if (tplMaxTime != null) {
              resourceForm.setFieldsValue({ maxTime: tplMaxTime });
            }
            if (tplNodeUnitCount != null) {
              resourceForm.setFieldsValue({ nodeUnitCount: tplNodeUnitCount });
            }
          }
        }
      }

      if (!partitionMatched) {
        const inferredTab: QueueKind = tplGpuCount != null && tplGpuCount > 0 ? "gpu" : "cpu";
        setActiveResourceTab(inferredTab);
        if (tplMaxTime != null) {
          resourceForm.setFieldsValue({ maxTime: tplMaxTime });
        }
        if (tplNodeUnitCount != null) {
          resourceForm.setFieldsValue({ nodeUnitCount: tplNodeUnitCount });
        }
      }

      const tplFramework = (cleanedFormData.framework ?? "single") as TrainFramework;
      const tplNodeCount = Math.max(1, (cleanedFormData.nodeCount as number) ?? 1);
      const frameworkUpdates: Partial<ResourceFormValues> = { framework: tplFramework };
      if (tplFramework === "tensorflow") {
        frameworkUpdates.psNodeCount = Math.max(0, (cleanedFormData.psNodes as number) ?? 0);
        frameworkUpdates.workerNodeCount = Math.max(1, (cleanedFormData.workerNodes as number) ?? 1);
      } else if (["single", "pytorch", "mpi", "mindspore"].includes(tplFramework)) {
        frameworkUpdates.distributedNodeCount = Math.max(1, tplNodeCount);
      }
      resourceForm.setFieldsValue(frameworkUpdates);

      appForm.setFieldsValue({
        mountPoints: normalizeMountPoints(cleanedFormData.mountPoints as unknown[] | undefined),
        envVariables: normalizeEnvVariables(cleanedFormData.envVariables as unknown[] | undefined),
      });

      const savedTensorBoard =
        typeof cleanedFormData.tensorBoardDataPath === "string"
          ? cleanedFormData.tensorBoardDataPath.trim()
          : undefined;
      if (savedTensorBoard) {
        appForm.setFieldsValue({ needTensorBoard: true, tensorBoardDataPath: savedTensorBoard });
      }

      const clusterChanged = templateCluster !== finalCluster;

      const tplDatasets = (cleanedFormData.datasets ?? []) as { id: number; isPrivate: boolean }[];
      const tplAlgorithms = (cleanedFormData.algorithms ?? []) as { id: number; isPrivate: boolean }[];
      const tplModels = (cleanedFormData.models ?? []) as { id: number; isPrivate: boolean }[];
      if (!clusterChanged && (tplDatasets.length || tplAlgorithms.length || tplModels.length)) {
        const [fetchedDatasets, fetchedAlgorithms, fetchedModels] = await Promise.all([
          tplDatasets.length
            ? trpcUtils.dataset.getAllDatasetVersions.fetch({ clusterId: finalCluster }).catch(() => undefined)
            : undefined,
          tplAlgorithms.length
            ? trpcUtils.algorithm.getAllAlgorithmVersions.fetch({ clusterId: finalCluster }).catch(() => undefined)
            : undefined,
          tplModels.length
            ? trpcUtils.model.getAllModelVersions.fetch({ clusterId: finalCluster }).catch(() => undefined)
            : undefined,
        ]);

        if (fetchedDatasets && tplDatasets.length) {
          const categories: ResourceCategory[] = [];
          const personal = (fetchedDatasets.personal ?? [])
            .map((d) => ({
              label: d.name,
              value: d.id,
              children: (d.versions ?? []).map((v) => ({
                label: v.versionName,
                value: v.id,
                children: [] as ResourceCategory[],
              })),
            }))
            .filter((d) => d.children.length > 0);
          const pub = (fetchedDatasets.public ?? [])
            .map((d) => ({
              label: d.name,
              value: d.id,
              children: (d.versions ?? []).map((v) => ({
                label: v.versionName,
                value: v.id,
                children: [] as ResourceCategory[],
              })),
            }))
            .filter((d) => d.children.length > 0);
          if (personal.length) categories.push({ label: "", value: 1, children: personal });
          if (pub.length) categories.push({ label: "", value: 2, children: pub });
          const lookup = buildSelectionPathLookup(categories);
          const selections = buildResubmitResourceSelections(tplDatasets, lookup);
          if (selections.length > 0) {
            appForm.setFieldsValue({ datasets: selections });
          }
        }

        if (fetchedAlgorithms && tplAlgorithms.length) {
          const categories: ResourceCategory[] = [];
          const personal = (fetchedAlgorithms.personal ?? [])
            .map((a) => ({
              label: a.name,
              value: a.id,
              children: (a.versions ?? []).map((v) => ({
                label: v.versionName,
                value: v.id,
                children: [] as ResourceCategory[],
              })),
            }))
            .filter((a) => a.children.length > 0);
          const pub = (fetchedAlgorithms.public ?? [])
            .map((a) => ({
              label: a.name,
              value: a.id,
              children: (a.versions ?? []).map((v) => ({
                label: v.versionName,
                value: v.id,
                children: [] as ResourceCategory[],
              })),
            }))
            .filter((a) => a.children.length > 0);
          if (personal.length) categories.push({ label: "", value: 1, children: personal });
          if (pub.length) categories.push({ label: "", value: 2, children: pub });
          const lookup = buildSelectionPathLookup(categories);
          const selections = buildResubmitResourceSelections(tplAlgorithms, lookup);
          if (selections.length > 0) {
            appForm.setFieldsValue({ algorithms: selections });
          }
        }

        if (fetchedModels && tplModels.length) {
          const categories: ResourceCategory[] = [];
          const personal = (fetchedModels.personal ?? [])
            .map((m) => ({
              label: m.name,
              value: m.id,
              children: (m.versions ?? []).map((v) => ({
                label: v.versionName,
                value: v.id,
                children: [] as ResourceCategory[],
              })),
            }))
            .filter((m) => m.children.length > 0);
          const pub = (fetchedModels.public ?? [])
            .map((m) => ({
              label: m.name,
              value: m.id,
              children: (m.versions ?? []).map((v) => ({
                label: v.versionName,
                value: v.id,
                children: [] as ResourceCategory[],
              })),
            }))
            .filter((m) => m.children.length > 0);
          if (personal.length) categories.push({ label: "", value: 1, children: personal });
          if (pub.length) categories.push({ label: "", value: 2, children: pub });
          const lookup = buildSelectionPathLookup(categories);
          const selections = buildResubmitResourceSelections(tplModels, lookup);
          if (selections.length > 0) {
            appForm.setFieldsValue({ models: selections });
          }
        }
      }

      let finalImageSource: TrainImageSourceKey | undefined;
      let finalImageValue: string | undefined;

      if (!clusterChanged) {
        const tplRemoteImageUrl = cleanedFormData.remoteImageUrl as string | undefined;
        const tplImageId = cleanedFormData.image as number | undefined;
        const tplIsImagePrivate = cleanedFormData.isImagePrivate as boolean | undefined;

        if (tplRemoteImageUrl) {
          finalImageSource = "remote";
          finalImageValue = tplRemoteImageUrl;
          imageSourceDraftsRef.current.remote = { image: tplRemoteImageUrl };
          setSelectedImageSource("remote");
          appForm.setFieldsValue({
            image: tplRemoteImageUrl,
            usePrivateImage: false,
            remoteUsername: undefined,
            remotePassword: undefined,
          });
        } else if (tplIsImagePrivate === true || tplIsImagePrivate === false) {
          const imageSource = tplIsImagePrivate ? "mine" : "public";
          finalImageSource = imageSource;
          if (tplImageId != null) {
            const fetchedImages = await trpcUtils.image.list
              .fetch({
                isPublic: tplIsImagePrivate ? parseBooleanParam(false) : parseBooleanParam(true),
                clusterId: finalCluster,
                withExternal: "true",
                types: ImageType.TRAIN,
              })
              .catch(() => undefined);
            if (fetchedImages) {
              const found = fetchedImages.items.some((img) => img.id === tplImageId && img.status === Status.CREATED);
              if (found) {
                finalImageValue = String(tplImageId);
                imageSourceDraftsRef.current[imageSource] = { image: String(tplImageId) };
                setSelectedImageSource(imageSource);
                appForm.setFieldsValue({ image: String(tplImageId) });
              } else {
                setSelectedImageSource(imageSource);
              }
            }
          } else {
            setSelectedImageSource(imageSource);
          }
        }
      }

      if (!clusterChanged) {
        const tplCommand = cleanedFormData.command as string | undefined;
        if (tplCommand) {
          appForm.setFieldsValue({ command: tplCommand });
          if (finalImageSource && finalImageValue) {
            const cacheKey = getCommandCacheKey(finalImageSource, finalImageValue);
            commandCacheRef.current[cacheKey] = { default: undefined, custom: tplCommand };
          }
        }
      }

      setTemplateListOpen(false);
      requestAnimationFrame(() => {
        isApplyingTemplateRef.current = false;
      });
    };

    if (unavailableParams.length > 0) {
      setUnavailableParamsModal({ params: unavailableParams, applyFn });
    } else {
      await applyFn();
    }
  };

  const handleCancel = () => {
    router.push("/jobs/jobList");
  };

  // ======================= 渲染 =======================
  return (
    <>
      <JobPageLayout>
        <JobMainContent>
          <JobContainer direction="vertical" size={0}>
            <div style={{ position: "relative" }}>
              <PaddedCard
                styles={{ header: { borderBottom: "none" } }}
                title={
                  <HeaderRow
                    align="center"
                    size={16}
                    style={{
                      justifyContent: "space-between",
                      borderBottom: `1px solid ${theme.palette.gray[4]}`,
                      paddingBottom: 24,
                    }}
                  >
                    <HeaderTitle>{t(pTrain("createTrainTitle"))}</HeaderTitle>
                    {/* <Button type="link" style={{ padding: 0, fontSize: 16 }} onClick={() => setTemplateListOpen(true)}>
                      {t(pTrain("templateButton"))}
                    </Button> */}
                  </HeaderRow>
                }
              >
                <BorderlessCard $showDivider title={<SectionTitle>{t(p("basicInfoSectionTitle"))}</SectionTitle>}>
                  <BaseInfoSection form={baseForm} jobName={jobName} onJobNameChange={handleJobNameChange} />
                </BorderlessCard>
              </PaddedCard>
            </div>

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
              selectedPresetUnit={selectedPresetUnit}
              onSelectedPresetUnitChange={setSelectedPresetUnit}
              maxJobRunningTimeHours={maxJobRunningTimeHours}
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
              homeDir={userHomeDir?.path}
            />
          </JobContainer>
        </JobMainContent>

        <JobSidePanel>
          <JobSidePanelInner>
            <SidePanelGroupWrapper>
              <JobSideInfo
                labels={{
                  totalGpuCount: t(p("sideInfo.totalGpuCount")),
                  totalCoreCount: t(p("sideInfo.totalCoreCount")),
                  totalMemory: t(p("sideInfo.totalMemory")),
                  costPerHour: t(p("hourlyCostLabel")),
                  pricingStandard: t(p("chargeStandard")),
                  yuan: t(p("yuan")),
                  hours: t(p("hours")),
                  accountNameLabel: t(p("sideInfo.accountNameLabel")),
                  whitelistTag: t(p("sideInfo.whitelistTag")),
                  accountOwner: t(p("sideInfo.accountOwner")),
                  accountBalance: t(p("sideInfo.accountBalance")),
                  accountBlockThreshold: t(p("sideInfo.accountBlockThreshold")),
                  userUsedLimit: t(p("sideInfo.userUsedLimit")),
                  userChargeNoLimit: t(p("sideInfo.userChargeNoLimit")),
                }}
                totalGpuCount={displayedGpu}
                totalCpuCount={displayedCpu}
                totalMemory={displayedMemory}
                hourlyPrice={formattedHourlyPrice}
                showHourlyPriceUnit={jobOneHourPrice != null}
                pricingStandardUrl={join(misPath, "/user/partitions")}
                showAccountInfo={publicConfig.MIS_DEPLOYED}
                accountInfo={accountInfo ?? null}
              />
            </SidePanelGroupWrapper>
          </JobSidePanelInner>
        </JobSidePanel>
      </JobPageLayout>

      <FixedFooter>
        {/* <div style={{ marginLeft: 208, marginRight: "auto" }}>
          <FooterStatValue
            $isPrimaryColor
            style={{ cursor: "pointer", userSelect: "none", textDecoration: "none" }}
            onClick={async () => {
              try {
                await resourceForm.validateFields();
                await appForm.validateFields();
                setTemplateSnapshot(buildTrainTemplateFormData());
                setSaveTemplateOpen(true);
              } catch {
                message.warning(t(p("completeFormFirst")));
              }
            }}
          >
            {t(p("saveAsTemplate"))}
          </FooterStatValue>
        </div> */}
        <FooterActions>
          <Button onClick={handleCancel}>{t(p("cancel"))}</Button>
          <Button type="primary" onClick={handleSubmit} loading={createTrainJobMutation.isPending}>
            {t(p("submit"))}
          </Button>
        </FooterActions>
      </FixedFooter>
      <SaveAsTemplateModal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        jobType={JobType.TRAIN}
        cluster={selectedCluster ?? ""}
        formData={templateSnapshot}
      />
      <TemplateListModal
        open={templateListOpen}
        onClose={() => setTemplateListOpen(false)}
        onUse={handleTemplateUse}
        jobType={JobType.TRAIN}
      />
      <UnavailableParamsModal
        open={!!unavailableParamsModal}
        params={unavailableParamsModal?.params ?? []}
        onConfirm={async () => {
          await unavailableParamsModal?.applyFn();
          setUnavailableParamsModal(null);
        }}
        onCancel={() => setUnavailableParamsModal(null)}
      />
    </>
  );
};
