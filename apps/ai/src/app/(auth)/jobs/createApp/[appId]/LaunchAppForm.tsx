"use client";

import type { ColumnsType } from "antd/es/table";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelector.shared";
import type { CreateAppInput } from "src/server/trpc/route/jobs/apps";
import type { AppTemplateFormData, TemplateFormData } from "src/server/trpc/route/jobs/templates";

import { FixedFooter, FooterActions, FooterStatValue } from "@scow/lib-web/build/components/job/Footer";
import { JobPageHeader } from "@scow/lib-web/build/components/job/JobPageHeader";
import { JobSideInfo } from "@scow/lib-web/build/components/job/JobSideInfo";
import { BorderlessCard, PaddedCard } from "@scow/lib-web/build/components/styledAntdCom/DualTitleCard";
import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import {
  RoundedInput,
  RoundedInputNumber,
  RoundedPasswordInput,
} from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import {
  JobContainer,
  JobMainContent,
  JobPageLayout,
  JobSidePanel,
  JobSidePanelInner,
  JobSidePanelScrollBox,
} from "@scow/lib-web/build/layouts/base/JobContainer";
import { convertDurationToHours } from "@scow/lib-web/build/utils/form";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Space, Typography } from "antd";
import { Rule } from "antd/es/form";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { join } from "path";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { usePublicConfig } from "src/app/(auth)/context";
import { SaveAsTemplateModal } from "src/app/(auth)/jobs/components/SaveAsTemplateModal";
import { TemplateListModal } from "src/app/(auth)/jobs/components/TemplateListModal";
import { UnavailableParam, UnavailableParamsModal } from "src/app/(auth)/jobs/components/UnavailableParamsModal";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { HeaderAvatar, SidePanelGroupWrapper } from "src/app/(auth)/jobs/LaunchJobForm.styles";
import { MAX_TIME_PRESETS } from "src/app/(auth)/jobs/maxTime";
import { PublicImageOption } from "src/app/(auth)/jobs/PublicImageOption";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ImageType, Status } from "src/models/Image";
import { JobType } from "src/models/Job";
import { formatSize } from "src/utils/format";
import { parseBooleanParam } from "src/utils/parse";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import type {
  AppFormValues,
  BaseFormValues,
  CommandCacheEntry,
  CPUQueueRow,
  GPUQueueRow,
  ImageOption,
  ImageSourceDraft,
  ImageSourceKey,
  MaxTimeUnit,
  MountPointField,
  QueueKind,
  QueueRow,
  ResourceFormValues,
  VersionGroup,
} from "./LaunchAppForm.types";

import { AppConfigSection } from "./components/AppConfigSection";
import { BaseInfoSection } from "./components/BaseInfoSection";
import { ResourceConfigSection } from "./components/ResourceConfigSection";
import {
  buildEnvPayload,
  buildAccountOptions,
  buildResubmitResourceSelections,
  buildSelectionPathLookup,
  buildUnavailableParams,
  buildVersionLookup,
  cleanFormData,
  deriveQueueStats,
  getCommandCacheKey,
  initBuiltinEnvVariables,
  mapQueuesToRows,
  normalizeEnvVariables,
  normalizeMountPoints,
  mergeResubmitEnvVariables,
  renderCascaderLabels,
  sanitizeFormMountAndEnvValues,
  toIdPrivateList,
} from "./LaunchAppForm.utils";

// ======================= 类型定义 =======================
interface Props {
  publicPath: string;
  misPath: string;
  appId: string;
  appName?: string;
  appLogoPath?: string;
  appComment?: string;
  appImage?: string;
  appStartCommand?: string;
  createAppParams?: CreateAppInput;
  clusterId?: string;
}

const p = prefix("app.jobs.launchAppForm.");
const pJobDetails = prefix("app.jobs.jobDetails.");
const pPublicOption = prefix("app.jobs.publicImageOption.");
type LaunchAppFormKey = Parameters<typeof p>[0];
type ImageSourceLabelKey = Extract<LaunchAppFormKey, `imageSourceTabs.${string}`>;
type ImagePlaceholderKey = Extract<LaunchAppFormKey, `imagePlaceholders.${string}`>;

// 镜像来源配置（label & placeholder 的 key）
const IMAGE_SOURCE_TAB_CONFIG: readonly {
  key: ImageSourceKey;
  labelKey: ImageSourceLabelKey;
  placeholderKey: ImagePlaceholderKey;
}[] = [
  { key: "preset", labelKey: "imageSourceTabs.preset", placeholderKey: "imagePlaceholders.preset" },
  { key: "mine", labelKey: "imageSourceTabs.mine", placeholderKey: "imagePlaceholders.mine" },
  { key: "public", labelKey: "imageSourceTabs.public", placeholderKey: "imagePlaceholders.public" },
  { key: "remote", labelKey: "imageSourceTabs.remote", placeholderKey: "imagePlaceholders.remote" },
];

const IMAGE_PLACEHOLDER_KEYS: Record<ImageSourceKey, ImagePlaceholderKey> = {
  preset: "imagePlaceholders.preset",
  mine: "imagePlaceholders.mine",
  public: "imagePlaceholders.public",
  remote: "imagePlaceholders.remote",
} as const;

type TranslateFn = ReturnType<typeof useI18nTranslateToString>;

const AppCommentContainer = styled.div`
  max-width: 100%;
  overflow-x: auto;
  color: ${({ theme }) => theme.palette.gray[8]};

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  table {
    border-collapse: collapse;
    width: max-content;
    max-width: 100%;
    margin: 8px 0;
  }

  th,
  td {
    border: 1px solid ${({ theme }) => theme.token.colorBorder};
    padding: 8px 12px;
  }

  pre {
    background-color: ${({ theme }) => theme.token.colorFillTertiary};
    border-radius: 4px;
    padding: 12px;
    overflow: auto;
  }

  code {
    background-color: ${({ theme }) => theme.token.colorFillTertiary};
    border-radius: 4px;
    padding: 2px 4px;
  }

  pre code {
    background-color: transparent;
    padding: 0;
  }
`;

const SidePanelDivider = styled.div`
  height: 1px;
  margin: 16px 0px;
  background: ${({ theme }) => theme.palette.gray[4]};
  flex-shrink: 0;
`;

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
export const LaunchAppForm = ({
  publicPath,
  misPath,
  appId,
  appName,
  appLogoPath,
  appComment,
  appImage,
  appStartCommand,
  createAppParams,
  clusterId,
}: Props) => {
  const { currentLanguage } = useI18n();
  const languageId = currentLanguage.id;
  const t = useI18nTranslateToString();
  const { publicConfig, scowClusterConfigs, currentAvailableClusterIds } = usePublicConfig();

  // 配置文件中所有的AI集群
  const { CLUSTERS } = publicConfig;
  const router = useRouter();

  const { message } = App.useApp();
  // ======================= 状态与引用 =======================
  const [baseForm] = Form.useForm<BaseFormValues>();
  const [resourceForm] = Form.useForm<ResourceFormValues>();
  const [appForm] = Form.useForm<AppFormValues>();

  useEffect(() => {
    const messageKey = "createAppClusterParamError";
    const clusterAvailable = clusterId ? currentAvailableClusterIds.includes(clusterId) : false;

    if (!clusterAvailable) {
      message.error({
        key: messageKey,
        content: t(p("invalidClusterParam"), [clusterId ?? ""]),
      });
      return;
    }
  }, [clusterId, currentAvailableClusterIds]);

  const hasInitializedBuiltinEnvVariablesRef = useRef(false);
  useEffect(() => {
    if (hasInitializedBuiltinEnvVariablesRef.current) {
      return;
    }

    initBuiltinEnvVariables(appForm, Boolean(createAppParams));
    hasInitializedBuiltinEnvVariablesRef.current = true;
  }, [appForm, createAppParams]);

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
  const initialJobName = useMemo(
    () => `${appName ?? "app"}-${dayjs().format("YYMMDD-HHmmss")}`.toLowerCase(),
    [appName],
  );
  const [jobName, setJobName] = useState(initialJobName);
  const [activeResourceTab, setActiveResourceTab] = useState<QueueKind>("gpu");
  const [selectedQueueKey, setSelectedQueueKey] = useState<string | undefined>();
  const [selectedImageSource, setSelectedImageSource] = useState<ImageSourceKey>("preset");
  // 记录不同镜像来源下用户填写的草稿，切换标签时可恢复
  const imageSourceDraftsRef = useRef<Record<ImageSourceKey, ImageSourceDraft>>({
    preset: {},
    mine: {},
    public: {},
    remote: {},
  });

  // 缓存每种镜像来源的默认命令和用户修改，用于切换镜像时恢复输入框内容
  const commandCacheRef = useRef<Record<string, CommandCacheEntry>>({});
  // 防止同步命令时触发双向写入造成的死循环
  const isSyncingCommandRef = useRef(false);
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
  const resubmitCustomFieldsAppliedRef = useRef(false);
  const [maxTimeUnit, setMaxTimeUnit] = useState<MaxTimeUnit>("hour");
  const [selectedPresetUnit, setSelectedPresetUnit] = useState<MaxTimeUnit | undefined>("min");

  // createAppParams is used directly by resubmit effects (no template merge)

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [templateSnapshot, setTemplateSnapshot] = useState<AppTemplateFormData | null>(null);
  const [unavailableParamsModal, setUnavailableParamsModal] = useState<{
    params: UnavailableParam[];
    applyFn: () => void | Promise<void>;
  } | null>(null);

  // 账户集群关系
  const { data: appAvailableAccountsAndClusters } = trpc.jobs.listAppAvailableAccountsAndClusters.useQuery({
    appId,
  });

  const accountClusterMap = appAvailableAccountsAndClusters?.accountClusters ?? {};
  const accountDetails = appAvailableAccountsAndClusters?.accountDetails ?? [];
  const appUnauthorizedMessage = t("app.jobs.createApps.appUnauthorized");

  useEffect(() => {
    if (!clusterId || !appAvailableAccountsAndClusters) {
      return;
    }

    const isAppAvailable = Object.values(appAvailableAccountsAndClusters.accountClusters).some((clusters) =>
      clusters.includes(clusterId),
    );
    if (!isAppAvailable) {
      message.error({
        content: appUnauthorizedMessage,
        key: `app-unauthorized-${clusterId}-${appId}`,
      });
    }
  }, [appAvailableAccountsAndClusters, appId, appUnauthorizedMessage, clusterId, message]);

  // 创建应用的集群由入口页决定，账户只展示能访问该集群的项。
  const accountOptions = useMemo(
    () =>
      buildAccountOptions(
        accountDetails.filter(({ clusters }) => (clusterId ? clusters.includes(clusterId) : false)),
        t,
      ),
    [accountDetails, clusterId, t],
  );
  const availableAccountOptions = useMemo(() => accountOptions.filter(({ disabled }) => !disabled), [accountOptions]);

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

  const { data: accountInfo } = trpc.account.getAccountInfo.useQuery(
    { accountName: selectedAccount! },
    {
      enabled: Boolean(selectedAccount),
      retry: false,
    },
  );

  // ----------- 服务请求与变更提示 -----------
  // 创建应用作业的 RPC 请求，集中处理成功跳转和常见错误提示
  const createAppSessionMutation = trpc.jobs.createAppSession.useMutation({
    onSuccess: () => {
      message.success(t(p("submitSuccessfully")));
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
        const clusterName = publicConfig.CLUSTERS.find((x) => x.id === detail.clusterId)?.name || detail.clusterId;
        const i18nClusterName = getI18nConfigCurrentText(clusterName, currentLanguage.id);
        message.error(
          t(p("submitFailedAccountPartitionUnavailable"), [
            detail.accountName ?? "",
            i18nClusterName,
            detail.partitionName,
          ]),
        );
        return;
      }
      if (detail?.type === "app_not_available" && detail.appId) {
        message.error(t(p("submitFailedAccountAppUnavailable"), [detail.accountName ?? "", detail.appId]));
        return;
      }
      message.error(t(p("submitFailedWithReason"), [error.message]));
    },
  });

  const sanitizeAppFormValues = () => sanitizeFormMountAndEnvValues(appForm);

  // ----------- 交互处理逻辑 -----------
  const handleImageSourceChange = (nextSource: ImageSourceKey) => {
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
    ? scowClusterConfigs[selectedCluster]?.ai?.app?.maxRunningTimeHours
    : undefined;

  // 拉取所选集群下该应用的元信息（展示名、Logo、默认镜像/命令等）
  const { data: appInfo } = trpc.jobs.getAppMetadata.useQuery(
    { clusterId: selectedCluster!, appId },
    { enabled: !!selectedCluster },
  );

  const effectiveAppName = appInfo?.appName ?? appName ?? "";
  const effectiveAppLogoPath = appInfo?.appLogoPath ?? appLogoPath;
  const effectiveAppComment = appInfo?.appComment ?? appComment ?? "";
  const effectiveAppImage = appInfo?.appImage ? `${appInfo.appImage.name}:${appInfo.appImage.tag}` : appImage;
  const effectiveAppStartCommand = appInfo?.appStartCommand ?? appStartCommand;
  const appLogoSrc = effectiveAppLogoPath ? join(publicPath, effectiveAppLogoPath) : undefined;

  // 获取用户家目录
  const { data: userHomeDir } = trpc.file.getHomeDir.useQuery(
    { clusterId: selectedCluster! },
    { enabled: !!selectedCluster },
  );

  // 应用名称加载完成后自动生成默认作业名，避免初次打开表单时出现空值
  useEffect(() => {
    if (!effectiveAppName) {
      return;
    }
    const generated = `${effectiveAppName}-${dayjs().format("YYMMDD-HHmmss")}`.toLowerCase();
    // 仅在用户尚未编辑（仍是初始默认名）时刷新默认名称，避免清空后被自动回填
    if (jobName === initialJobName) {
      setJobName(generated);
      baseForm.setFieldValue("appJobName", generated);
    }
  }, [baseForm, effectiveAppName, initialJobName, jobName]);
  // 针对应用配置中的自定义属性，动态渲染不同类型的输入控件
  const customFormItems = useMemo(() => {
    const attributes = appInfo?.attributes;
    if (!attributes || attributes.length === 0) {
      return [];
    }

    return attributes.map((item, index) => {
      const rules: Rule[] =
        item.type === "NUMBER" ? [{ type: "integer" }, { required: item.required }] : [{ required: item.required }];

      const placeholder = item.placeholder ?? "";

      // 筛选选项：若没有配置requireGpu直接使用，配置了requireGpu项使用与否则看改分区有无GPU
      const selectOptions = item.select.filter((x) => !x.requireGpu || (x.requireGpu && activeResourceTab === "gpu"));
      const initialValue = item.type === "SELECT" ? (item.defaultValue ?? selectOptions[0].value) : item.defaultValue;

      const inputItem: JSX.Element =
        item.type === "NUMBER" ? (
          <RoundedInputNumber
            placeholder={getI18nConfigCurrentText(placeholder, languageId)}
            style={{ width: "480px" }}
          />
        ) : item.type === "TEXT" ? (
          <RoundedInput placeholder={getI18nConfigCurrentText(placeholder, languageId)} style={{ width: "480px" }} />
        ) : item.type === "PASSWORD" ? (
          <RoundedPasswordInput
            placeholder={getI18nConfigCurrentText(placeholder, languageId)}
            style={{ width: "480px" }}
          />
        ) : (
          <RoundedSelect
            options={selectOptions.map((x) => ({
              label: getI18nConfigCurrentText(x.label, languageId),
              value: x.value,
            }))}
            placeholder={getI18nConfigCurrentText(placeholder, languageId)}
            style={{ width: "480px" }}
          />
        );

      // 判断是否配置了requireGpu选项
      if (item.type === "SELECT" && item.select.find((i) => i.requireGpu !== undefined)) {
        const preValue = appForm.getFieldValue(item.name);

        if (preValue) {
          // 切换分区后看之前的版本是否还存在，若不存在，则选择版本的select的值置空
          const optionsContained = selectOptions.find((i) => i.value === preValue);
          if (!optionsContained) appForm.setFieldValue(item.name, null);
        }
      }

      return (
        <InlineFormItem
          key={`${item.name}+${index}`}
          label={<Label>{getI18nConfigCurrentText(item.label, languageId) ?? undefined}</Label>}
          name={["customFields", item.name]}
          rules={rules}
          initialValue={initialValue}
        >
          {inputItem}
        </InlineFormItem>
      );
    });
  }, [appInfo, activeResourceTab, languageId, t]);

  // 根据选中的账户与集群拉取对应的队列与资源详情
  // ----- 数据拉取：根据选中账户/集群实时刷新依赖数据 -----
  const { data: queueData, isLoading: getAvailablePartitionIsLoading } = trpc.config.getAvailablePartitions.useQuery(
    { accountName: selectedAccount!, clusterId: selectedCluster! },
    { enabled: !!selectedAccount && !!selectedCluster },
  );

  const { data: images, isLoading: isImagesLoading } = trpc.image.list.useQuery(
    {
      isPublic: selectedImageSource === "public" ? parseBooleanParam(true) : parseBooleanParam(false),
      clusterId: selectedCluster,
      withExternal: "true",
      types: ImageType.APP,
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

  // 根据 isPlatformOwned 构造发布者展示文字
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
      .map((algorithm) => {
        const ownerText = buildOwnerText(algorithm.isPlatformOwned, algorithm.ownerName, algorithm.ownerId);
        return {
          label: algorithm.name,
          value: algorithm.id,
          description: algorithm.description,
          ownerText,
          children: (algorithm.versions ?? []).map((version) => ({
            label: version.versionName,
            value: version.id,
            description: version.versionDescription,
            children: [],
          })),
        };
      })
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
      .map((dataset) => {
        const ownerText = buildOwnerText(dataset.isPlatformOwned, dataset.ownerName, dataset.ownerId);
        return {
          label: dataset.name,
          value: dataset.id,
          description: dataset.description,
          ownerText,
          children: (dataset.versions ?? []).map((version) => ({
            label: version.versionName,
            value: version.id,
            description: version.versionDescription,
            children: [],
          })),
        };
      })
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
      .map((model) => {
        const ownerText = buildOwnerText(model.isPlatformOwned, model.ownerName, model.ownerId);
        return {
          label: model.name,
          value: model.id,
          description: model.description ?? [model.algorithmName, model.algorithmFramework].filter(Boolean).join(" / "),
          ownerText,
          children: (model.versions ?? []).map((version) => ({
            label: version.versionName,
            value: version.id,
            description: version.versionDescription ?? version.algorithmVersion ?? undefined,
            children: [],
          })),
        };
      })
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
    if (!createAppParams) {
      resubmitCascaderAppliedRef.current.datasets = false;
      return;
    }
    if (resubmitCascaderAppliedRef.current.datasets) {
      return;
    }
    if (!datasetSelectionLookup.size) {
      return;
    }

    const selections = buildResubmitResourceSelections(createAppParams.datasets, datasetSelectionLookup);

    appForm.setFieldsValue({
      datasets: selections.length ? selections : [],
    });

    resubmitCascaderAppliedRef.current.datasets = true;
  }, [appForm, createAppParams, datasetSelectionLookup]);

  // 回填算法选择，同上
  useEffect(() => {
    if (!createAppParams) {
      resubmitCascaderAppliedRef.current.algorithms = false;
      return;
    }
    if (resubmitCascaderAppliedRef.current.algorithms) {
      return;
    }
    if (!algorithmSelectionLookup.size) {
      return;
    }

    const selections = buildResubmitResourceSelections(createAppParams.algorithms, algorithmSelectionLookup);

    appForm.setFieldsValue({
      algorithms: selections.length ? selections : [],
    });

    resubmitCascaderAppliedRef.current.algorithms = true;
  }, [algorithmSelectionLookup, appForm, createAppParams]);

  // 回填模型选择，同上
  useEffect(() => {
    if (!createAppParams) {
      resubmitCascaderAppliedRef.current.models = false;
      return;
    }
    if (resubmitCascaderAppliedRef.current.models) {
      return;
    }
    if (!modelSelectionLookup.size) {
      return;
    }

    const selections = buildResubmitResourceSelections(createAppParams.models, modelSelectionLookup);

    appForm.setFieldsValue({
      models: selections.length ? selections : [],
    });

    resubmitCascaderAppliedRef.current.models = true;
  }, [appForm, createAppParams, modelSelectionLookup]);

  useEffect(() => {
    if (!createAppParams) {
      resubmitMountEnvAppliedRef.current = false;
      return;
    }
    if (resubmitMountEnvAppliedRef.current) {
      return;
    }
    const mountPointsDraft = (createAppParams.mountPoints ?? [])
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

    const envVariablesDraft = (createAppParams.envVariables ?? [])
      .filter((env): env is { key: string; value: string } => Boolean(env?.key) && Boolean(env?.value))
      .map((env) => ({ key: env.key, value: env.value }));

    appForm.setFieldsValue({
      mountPoints: mountPointsDraft,
      envVariables: mergeResubmitEnvVariables(normalizeEnvVariables(envVariablesDraft)),
    });

    resubmitMountEnvAppliedRef.current = true;
  }, [appForm, createAppParams]);

  useEffect(() => {
    if (!createAppParams) {
      resubmitCustomFieldsAppliedRef.current = false;
      return;
    }
    if (!appInfo) {
      return;
    }
    if (resubmitCustomFieldsAppliedRef.current) {
      return;
    }

    const attributeList = appInfo.attributes ?? [];
    const attributeMap = new Map(attributeList.map((item) => [item.name, item.type]));
    const customFields: Record<string, string | number | undefined> = {};

    Object.entries(createAppParams.customAttributes ?? {}).forEach(([key, value]) => {
      if (!attributeMap.has(key) || value === undefined || value === null || value === "") {
        return;
      }

      const fieldType = attributeMap.get(key);
      if (fieldType === "NUMBER") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          customFields[key] = parsed;
        }
        return;
      }

      customFields[key] = typeof value === "string" ? value : String(value);
    });

    appForm.setFieldsValue({
      customFields,
    });

    resubmitCustomFieldsAppliedRef.current = true;
  }, [appForm, appInfo?.attributes, createAppParams]);

  // 如果用户来自「再次提交」或历史记录，提前解析镜像相关的偏好设置
  const resubmitImagePreference = useMemo(() => {
    if (!createAppParams) {
      return undefined;
    }

    if (createAppParams.remoteImageUrl) {
      const draft: ImageSourceDraft = {
        image: createAppParams.remoteImageUrl,
        usePrivateImage: Boolean(createAppParams.privateImageRepositoryCredentials),
        remoteUsername: createAppParams.privateImageRepositoryCredentials?.userName,
        remotePassword: createAppParams.privateImageRepositoryCredentials?.password,
      };
      return {
        source: "remote" as const,
        draft,
      };
    }

    if (createAppParams.image !== undefined && createAppParams.image !== null) {
      const draft: ImageSourceDraft = {
        image: String(createAppParams.image),
      };
      return {
        source: createAppParams.isImagePrivate === false ? ("public" as const) : ("mine" as const),
        draft,
      };
    }

    if (createAppParams.localImageName) {
      const draft: ImageSourceDraft = {
        image: createAppParams.localImageName,
      };
      return {
        source: "preset" as const,
        draft,
      };
    }

    if (effectiveAppImage) {
      const draft: ImageSourceDraft = {
        image: effectiveAppImage,
      };
      return {
        source: "preset" as const,
        draft,
      };
    }

    return undefined;
  }, [createAppParams, effectiveAppImage]);

  useEffect(() => {
    if (!createAppParams) {
      resubmitCascaderAppliedRef.current = {
        datasets: false,
        algorithms: false,
        models: false,
      };
    }
  }, [createAppParams]);

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
    const parseImageReference = (imageRef: string) => {
      const segments = imageRef.split(":");
      if (segments.length <= 1) {
        return { name: imageRef, tag: undefined };
      }
      const tag = segments.pop();
      return { name: segments.join(":"), tag };
    };

    if (selectedImageSource === "preset") {
      if (!effectiveAppImage) {
        return [];
      }
      const { name: rawName, tag: rawTag } = parseImageReference(effectiveAppImage);
      return [
        {
          label: effectiveAppImage,
          value: effectiveAppImage,
          displayLabel: effectiveAppImage,
          startCommand: effectiveAppStartCommand,
          rawName,
          rawTag,
          ownerName: undefined,
          ownerId: undefined,
        },
      ];
    }
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
  }, [effectiveAppImage, images, selectedImageSource, effectiveAppStartCommand, languageId]);

  // 统一选中值的类型，避免数字 ID 与字符串之间的比较问题
  const normalizedSelectedImageValue =
    selectedImageValue !== undefined && selectedImageValue !== null ? String(selectedImageValue) : undefined;

  const selectedImageOption = useMemo(
    () => imageOptionsForSource.find((item) => item.value === normalizedSelectedImageValue),
    [imageOptionsForSource, normalizedSelectedImageValue],
  );
  const lastCommandImageKeyRef = useRef<string | undefined>();
  const resubmitCommandKeyRef = useRef<string | undefined>();
  const resubmitCommandUsedRef = useRef<boolean>(false);
  const resubmitCommandLockedRef = useRef<boolean>(false);

  // 按镜像来源推导默认运行命令，方便表单自动补齐
  const currentCommandDefault = useMemo(() => {
    const trimmedResubmitCommand = createAppParams?.startCommand?.trim();
    const resubmitSource = resubmitImagePreference?.source;
    const currentCommandKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const resubmitCommandKey = resubmitImagePreference
      ? getCommandCacheKey(resubmitImagePreference.source, resubmitImagePreference.draft.image ?? undefined)
      : undefined;
    resubmitCommandKeyRef.current = resubmitCommandKey;

    if (
      createAppParams &&
      trimmedResubmitCommand &&
      resubmitSource === selectedImageSource &&
      resubmitCommandKey &&
      !resubmitCommandLockedRef.current &&
      currentCommandKey === resubmitCommandKey
    ) {
      if (selectedImageSource === "remote") {
        const currentRemote = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        if (currentRemote && createAppParams.remoteImageUrl === currentRemote) {
          return trimmedResubmitCommand;
        }
      }
      if (selectedImageSource === "preset") {
        const currentPreset = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        const expectedPreset = createAppParams.localImageName ?? effectiveAppImage;
        if (expectedPreset && currentPreset === expectedPreset) {
          return trimmedResubmitCommand;
        }
      }
      if (selectedImageSource === "mine" || selectedImageSource === "public") {
        const currentLocal = typeof selectedImageValue === "string" ? selectedImageValue : undefined;
        const expectedLocal =
          createAppParams.image !== undefined && createAppParams.image !== null
            ? String(createAppParams.image)
            : undefined;
        if (expectedLocal && currentLocal === expectedLocal) {
          return trimmedResubmitCommand;
        }
      }
    }

    if (selectedImageSource === "preset") {
      return effectiveAppStartCommand && effectiveAppStartCommand.trim().length > 0
        ? effectiveAppStartCommand
        : undefined;
    }

    if (selectedImageSource === "mine" || selectedImageSource === "public") {
      const start = selectedImageOption?.startCommand;
      return start && start.trim().length > 0 ? start : undefined;
    }

    return undefined;
  }, [
    createAppParams,
    resubmitImagePreference,
    effectiveAppImage,
    effectiveAppStartCommand,
    selectedImageOption,
    selectedImageSource,
    selectedImageValue,
    normalizedSelectedImageValue,
  ]);

  useEffect(() => {
    // 初始化/重置历史命令状态
    if (!createAppParams) {
      resubmitCommandKeyRef.current = undefined;
      resubmitCommandUsedRef.current = false;
      resubmitCommandLockedRef.current = false;
      return;
    }
    resubmitCommandUsedRef.current = false;
    resubmitCommandLockedRef.current = false;
  }, [createAppParams]);

  useEffect(() => {
    // 当已使用过历史命令且镜像 key 改变时，锁定历史命令，后续使用镜像默认值
    const currentKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const resubmitKey = resubmitCommandKeyRef.current;
    if (resubmitKey && resubmitCommandUsedRef.current && currentKey && currentKey !== resubmitKey) {
      resubmitCommandLockedRef.current = true;
    }
  }, [normalizedSelectedImageValue, selectedImageSource]);

  useEffect(() => {
    // 同步最新的预置镜像信息，避免 props 更新后表单仍展示旧值
    imageSourceDraftsRef.current.preset = effectiveAppImage ? { image: effectiveAppImage } : {};
    if (selectedImageSource === "preset" && appForm.getFieldValue("image") !== effectiveAppImage) {
      appForm.setFieldsValue({ image: effectiveAppImage });
    }
  }, [appForm, effectiveAppImage, selectedImageSource]);

  useEffect(() => {
    // 当镜像来源或选项发生变化时，将缓存中的默认/自定义命令同步到表单
    if (isApplyingTemplateRef.current) {
      return;
    }
    const currentKey = getCommandCacheKey(selectedImageSource, normalizedSelectedImageValue);
    const cache = commandCacheRef.current;
    const entry = cache[currentKey] ?? (cache[currentKey] = { default: currentCommandDefault });

    // 记录最新的镜像 key，避免误清空已有的自定义命令
    lastCommandImageKeyRef.current = currentKey;

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
      currentCommandDefault === (createAppParams?.startCommand?.trim() ?? undefined)
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

  const {
    totalUnits: queueTotalUnits,
    cpuPerUnit,
    memoryPerUnitText,
    memoryPerUnitMb,
    qosOptions,
  } = useMemo(() => deriveQueueStats(selectedQueueOption), [selectedQueueOption]);

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

  const formattedHourlyPrice = jobOneHourPrice == null ? "-" : jobOneHourPrice.toFixed(2);

  // 创建应用的集群由入口页决定，这里只展示入口集群，并根据在线状态与账户授权标记是否可用。
  const clusterOptions = useMemo(() => {
    if (!clusterId) {
      return [];
    }

    const cluster = CLUSTERS.find((item) => item.id === clusterId);
    if (!cluster) {
      return [];
    }

    const clusterOnline = (currentAvailableClusterIds ?? []).includes(clusterId);
    const accountAuthorized = selectedAccount ? (accountClusterMap[selectedAccount] ?? []).includes(clusterId) : false;

    return [
      {
        id: cluster.id,
        name: getI18nConfigCurrentText(cluster.name, languageId),
        disabled: !clusterOnline || !accountAuthorized,
      },
    ];
  }, [CLUSTERS, accountClusterMap, clusterId, currentAvailableClusterIds, languageId, selectedAccount]);

  useEffect(() => {
    // 再次提交时只回填账户；集群由入口页 clusterId 固定同步。
    if (!createAppParams) {
      resubmitResourceAppliedRef.current = false;
      return;
    }
    if (resubmitResourceAppliedRef.current) {
      return;
    }
    if (!availableAccountOptions.length) {
      return;
    }

    const targetAccount = createAppParams.account;
    const accountAvailable = targetAccount
      ? availableAccountOptions.some((option) => option.value === targetAccount)
      : false;

    if (accountAvailable && resourceForm.getFieldValue("account") !== targetAccount) {
      resourceForm.setFieldValue("account", targetAccount);
    }

    resubmitResourceAppliedRef.current = true;
  }, [availableAccountOptions, createAppParams, resourceForm]);

  useEffect(() => {
    // 再次提交时回填队列、优先级与核心/加速卡数以及运行时长
    if (isApplyingTemplateRef.current) {
      return;
    }
    if (!createAppParams) {
      resubmitQueueAppliedRef.current = false;
      return;
    }
    if (!queueRowById.size || resubmitQueueAppliedRef.current) {
      return;
    }

    if (!selectedCluster) {
      return;
    }

    if (createAppParams.clusterId && selectedCluster && createAppParams.clusterId !== selectedCluster) {
      return;
    }

    const targetQueueId = createAppParams.partition;
    const targetQueue = targetQueueId ? queueRowById.get(targetQueueId) : undefined;

    const nextTab: QueueKind = targetQueue?.type ?? ((createAppParams.gpuCount ?? 0) > 0 ? "gpu" : "cpu");

    if (activeResourceTab !== nextTab) {
      setActiveResourceTab(nextTab);
    }

    let maxTimeValue: number | undefined;
    if (createAppParams.maxTime !== undefined && createAppParams.maxTime !== null) {
      const minutes = Math.max(1, createAppParams.maxTime);
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

    const qosList = targetQueue.qosOptions ?? [];
    if (createAppParams.qos) {
      if (qosList.includes(createAppParams.qos)) {
        updates.priority = createAppParams.qos;
      } else {
        updates.priority = undefined;
      }
    } else {
      updates.priority = undefined;
    }

    if (targetQueue.type === "gpu") {
      if (createAppParams.gpuCount !== undefined && createAppParams.gpuCount !== null) {
        const normalizedGpu = Math.max(1, createAppParams.gpuCount);
        const perPodLimit =
          typeof targetQueue.maxAcceleratorsPerPod === "number" && targetQueue.maxAcceleratorsPerPod > 0
            ? targetQueue.maxAcceleratorsPerPod
            : undefined;
        const queueLimit = targetQueue.totalUnits;
        const effectiveLimit = perPodLimit !== undefined ? Math.min(queueLimit, perPodLimit) : queueLimit;
        updates.gpuCores = Math.min(normalizedGpu, effectiveLimit);
      } else {
        updates.gpuCores = undefined;
      }
      if (createAppParams.coreCount !== undefined && createAppParams.coreCount !== null) {
        updates.cpuCores = Math.max(1, createAppParams.coreCount);
      } else {
        updates.cpuCores = undefined;
      }
    } else {
      updates.gpuCores = undefined;
      if (createAppParams.coreCount !== undefined && createAppParams.coreCount !== null) {
        updates.cpuCores = Math.max(1, createAppParams.coreCount);
      } else {
        updates.cpuCores = undefined;
      }
    }

    if (maxTimeValue !== undefined) {
      updates.maxTime = maxTimeValue;
    }

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
    createAppParams,
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

    if (createAppParams && !resubmitQueueAppliedRef.current) {
      return;
    }

    const currentSelection = currentQueueOptions.find((option) => option.id === selectedQueueKey);
    if (!currentSelection) {
      const savedQueueId = createAppParams?.partition;
      if (createAppParams && selectedQueueKey === savedQueueId) {
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
  }, [createAppParams, currentQueueOptions, getAvailablePartitionIsLoading, selectedQueueKey]);

  // 若用户尚未选择账户，自动填入第一条有效账户
  useEffect(() => {
    if (createAppParams && !resubmitResourceAppliedRef.current) {
      return;
    }
    if (!availableAccountOptions.length) {
      resourceForm.setFieldValue("account", undefined);
      return;
    }

    const currentAccount = selectedAccount ?? resourceForm.getFieldValue("account");

    if (!currentAccount || !availableAccountOptions.some((option) => option.value === currentAccount)) {
      resourceForm.setFieldValue("account", availableAccountOptions[0].value);
    }
  }, [availableAccountOptions, createAppParams, resourceForm, selectedAccount]);

  // 集群由入口页决定，表单字段只同步入口 clusterId。
  useEffect(() => {
    if (!clusterId) {
      return;
    }

    const currentCluster = resourceForm.getFieldValue("cluster");
    if (currentCluster !== clusterId) {
      resourceForm.setFieldValue("cluster", clusterId);
    }
  }, [clusterId, resourceForm]);

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

  useEffect(() => {
    if (activeResourceTab !== "gpu") {
      return;
    }
    if (!selectedQueueOption || selectedQueueOption.type !== "gpu") {
      return;
    }
    if (typeof gpuUnitLimit !== "number" || gpuUnitLimit <= 0) {
      return;
    }
    const currentValue = resourceForm.getFieldValue("gpuCores");
    if (typeof currentValue === "number" && currentValue > gpuUnitLimit) {
      resourceForm.setFieldValue("gpuCores", gpuUnitLimit);
    }
  }, [activeResourceTab, gpuUnitLimit, resourceForm, selectedQueueOption]);

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
    // For preset source, ensure we default to the first option when nothing is selected
    if (selectedImageSource !== "preset") {
      return;
    }
    if (!imageOptionsForSource.length) {
      return;
    }

    const currentImage = appForm.getFieldValue("image");
    if (typeof currentImage === "string" && currentImage.trim()) {
      imageSourceDraftsRef.current.preset = { image: currentImage };
      return;
    }

    const defaultPreset = imageOptionsForSource[0];
    imageSourceDraftsRef.current.preset = { image: defaultPreset.value };
    if (currentImage !== defaultPreset.value) {
      appForm.setFieldsValue({ image: defaultPreset.value });
    }
  }, [appForm, imageOptionsForSource, selectedImageSource]);

  useEffect(() => {
    // Ensure preset image fills its default start command when available
    if (selectedImageSource !== "preset") {
      return;
    }
    if (!currentCommandDefault) {
      return;
    }

    const currentCommand = appForm.getFieldValue("command");
    if (typeof currentCommand === "string" && currentCommand.trim().length > 0) {
      return;
    }
    appForm.setFieldsValue({ command: currentCommandDefault });
  }, [appForm, currentCommandDefault, selectedImageSource]);

  useEffect(() => {
    // 再次提交时回填镜像来源、镜像值以及私有仓库信息（等待集群重置完成）
    if (!resubmitImagePreference) {
      return;
    }

    if (resubmitImageAppliedRef.current) {
      return;
    }

    const { source, draft } = resubmitImagePreference;
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
    const isPreset = source === "preset";
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

    if (isPreset) {
      if (currentSource !== "preset") {
        setSelectedImageSource("preset");
        return;
      }
      if (!effectiveAppImage || desiredImage !== effectiveAppImage) {
        imageSourceDraftsRef.current.preset = {};
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
  }, [
    appForm,
    effectiveAppImage,
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

    if (createAppParams) {
      if (!resubmitQueueAppliedRef.current) {
        return;
      }
      const savedPriority = createAppParams.qos;
      const savedQueueId = createAppParams.partition;

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
  }, [createAppParams, resourceForm, selectedQueueKey, selectedQueueOption]);

  const handleCancel = () => {
    router.push("/jobs/createApp");
  };

  const buildAppTemplateFormData = (): AppTemplateFormData => {
    const resourceValues = resourceForm.getFieldsValue();
    const appValues = appForm.getFieldsValue();
    const passwordAttributeNames = new Set(
      appInfo?.attributes.filter((attribute) => attribute.type === "PASSWORD").map((attribute) => attribute.name) ?? [],
    );
    const gpuTypeValue = selectedQueueOption?.type === "gpu" ? (selectedQueueOption as GPUQueueRow).gpuType : undefined;
    return {
      account: selectedAccount ?? undefined,
      appId,
      partition: selectedQueueKey ?? undefined,
      qos: resourceValues.priority ?? undefined,
      coreCount: resourceValues.cpuCores ?? 1,
      nodeCount: 1,
      gpuCount: selectedGpuCount > 0 ? selectedGpuCount : undefined,
      gpuType: gpuTypeValue ?? undefined,
      maxTime: resourceValues.maxTime ?? 60,
      maxTimeUnit: selectedPresetUnit ?? maxTimeUnit,
      isImagePrivate:
        selectedImageSource === "mine" || selectedImageSource === "public" ? selectedImageSource === "mine" : undefined,
      image:
        selectedImageSource === "mine" || selectedImageSource === "public"
          ? Number(appValues.image) || undefined
          : undefined,
      localImageName:
        selectedImageSource === "preset"
          ? typeof appValues.image === "string"
            ? appValues.image
            : undefined
          : undefined,
      remoteImageUrl:
        selectedImageSource === "remote"
          ? typeof appValues.image === "string"
            ? appValues.image
            : undefined
          : undefined,
      startCommand: appValues.command ?? undefined,
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
      envVariables: buildEnvPayload(appValues.envVariables),
      workingDirectory:
        typeof appValues.customFields?.workingDir === "string" ? appValues.customFields.workingDir : undefined,
      customAttributes: Object.fromEntries(
        Object.entries(appValues.customFields ?? {})
          .filter(([key]) => !passwordAttributeNames.has(key))
          .map(([key, value]) => [key, value ?? undefined]),
      ),
    };
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
      console.error("Failed to validate create app session form:", error);
      return;
    }

    try {
      const { account, cluster, priority: qos, gpuCores, cpuCores, maxTime } = resourceValues;
      const partition = selectedQueueKey;
      const queueOption = selectedQueueOption;

      if (!cluster || !account || !partition || !queueOption) {
        message.error(t(p("selectValidAccountClusterQueue")));
        return;
      }

      const isGpuQueue = queueOption.type === "gpu";
      const requestedGpuCount = isGpuQueue ? (gpuCores ?? 0) : 0;
      const requestedCpuInput = cpuCores ?? 0;

      const unitCount = isGpuQueue ? requestedGpuCount : requestedCpuInput;
      if (unitCount <= 0) {
        message.error(t(p("invalidResourceConfig")));
        return;
      }

      const requestedCpuCount = isGpuQueue
        ? Math.max(1, Math.round((cpuPerUnit ?? 0) * requestedGpuCount))
        : requestedCpuInput;

      if (requestedCpuCount <= 0) {
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

      // 仅保留当前应用定义的自定义字段，避免提交多余键
      const attributeNames = appInfo?.attributes?.map((item) => item.name) ?? [];
      const customAttributesEntries = Object.entries(appValues.customFields ?? {})
        .filter(([key, value]) => attributeNames.includes(key) && value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [key, value!]);

      const customAttributes = Object.fromEntries(customAttributesEntries);

      let imageId: number | undefined;
      let remoteImageUrl: string | undefined;
      let isImagePrivate: boolean | undefined;
      let localImageName: string | undefined;

      // 不同镜像来源需要组装不同字段，提前归类成统一 payload
      if (selectedImageSource === "preset") {
        localImageName = effectiveAppImage;
      } else if (selectedImageSource === "mine" || selectedImageSource === "public") {
        if (normalizedSelectedImageValue) {
          const parsed = Number(normalizedSelectedImageValue);
          if (!Number.isNaN(parsed)) {
            imageId = parsed;
          }
        }
        isImagePrivate = selectedImageSource === "mine";
        localImageName = typeof selectedImageOption?.label === "string" ? selectedImageOption.label : undefined;
      } else if (selectedImageSource === "remote") {
        remoteImageUrl = appValues.image?.trim();
        if (!remoteImageUrl) {
          message.error(t(p("remoteImageRequired")));
          return;
        }
      }

      const trimmedCommand = appValues.command?.trim();
      const startCommandValue = trimmedCommand ? trimmedCommand : undefined;

      // 所有校验通过后，调用后端接口创建应用会话
      await createAppSessionMutation.mutateAsync({
        clusterId: cluster,
        appId,
        appName: effectiveAppName,
        appJobName: baseValues.appJobName,
        algorithms: algorithmsPayload,
        image: imageId,
        isImagePrivate,
        localImageName,
        remoteImageUrl,
        startCommand: startCommandValue,
        datasets: datasetsPayload,
        models: modelsPayload,
        mountPoints: mountPointsPayload.length ? mountPointsPayload : undefined,
        account,
        partition,
        qos,
        coreCount: requestedCpuCount,
        nodeCount: 1,
        gpuCount: isGpuQueue ? requestedGpuCount : undefined,
        memory: memoryMb,
        maxTime: maxTimeMinutes,
        customAttributes,
        gpuType: queueOption.type === "gpu" ? queueOption.gpuType : undefined,
        envVariables: envVariablesPayload.length ? envVariablesPayload : undefined,
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
      console.error("Failed to submit create app session form:", error);
    }
  };

  const handleTemplateUse = async (formData: TemplateFormData, templateCluster: string) => {
    if (!clusterId) {
      message.error(t(p("selectValidAccountClusterQueue")));
      return;
    }

    const fd = formData;

    const { unavailableParams, effectiveAccount: effectiveAcc } = await buildUnavailableParams({
      fd,
      templateCluster,
      isAccountAvailable: (acc) => availableAccountOptions.some((o) => o.value === acc),
      getAvailableAccounts: () => availableAccountOptions.map((o) => o.value),
      getClustersForAccount: (acc) => ((accountClusterMap[acc] ?? []).includes(clusterId) ? [clusterId] : []),
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
      commandCacheRef.current = {};

      resourceForm.setFieldsValue({ account: effectiveAcc, cluster: clusterId });

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
      let partitionMatched = false;

      if (tplPartition) {
        const partitionsForCluster = await trpcUtils.config.getAvailablePartitions
          .fetch({ accountName: effectiveAcc, clusterId })
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
            if (matchedRow?.type === "gpu") {
              if (tplGpuCount != null) {
                const perPodLimit =
                  typeof matchedRow.maxAcceleratorsPerPod === "number" ? matchedRow.maxAcceleratorsPerPod : undefined;
                const maxGpu =
                  perPodLimit != null ? Math.min(matchedRow.totalUnits, perPodLimit) : matchedRow.totalUnits;
                resourceForm.setFieldsValue({ gpuCores: Math.min(tplGpuCount, maxGpu) });
              }
              if (tplCoreCount != null) {
                resourceForm.setFieldsValue({ cpuCores: tplCoreCount });
              }
            } else {
              if (tplCoreCount != null) {
                resourceForm.setFieldsValue({
                  cpuCores: Math.min(tplCoreCount, matchedRow?.totalUnits ?? tplCoreCount),
                });
              }
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
        if (inferredTab === "gpu") {
          if (tplGpuCount != null) {
            resourceForm.setFieldsValue({ gpuCores: tplGpuCount });
          }
          if (tplCoreCount != null) {
            resourceForm.setFieldsValue({ cpuCores: tplCoreCount });
          }
        } else {
          if (tplCoreCount != null) {
            resourceForm.setFieldsValue({ cpuCores: tplCoreCount });
          }
        }
      }

      appForm.setFieldsValue({
        mountPoints: normalizeMountPoints(cleanedFormData.mountPoints as unknown[] | undefined),
        envVariables: mergeResubmitEnvVariables(
          normalizeEnvVariables(cleanedFormData.envVariables as unknown[] | undefined),
        ),
      });

      const tplCustomAttributes = cleanedFormData.customAttributes as Record<string, unknown> | undefined;
      const tplWorkingDirectory = cleanedFormData.workingDirectory as string | undefined;
      if (tplCustomAttributes || tplWorkingDirectory) {
        const attributeList = appInfo?.attributes ?? [];
        const attributeMap = new Map(attributeList.map((item) => [item.name, item.type]));
        const customFields: Record<string, string | number | undefined> = {};

        if (tplCustomAttributes) {
          Object.entries(tplCustomAttributes).forEach(([key, value]) => {
            if (!attributeMap.has(key) || value === undefined || value === null || value === "") {
              return;
            }
            const fieldType = attributeMap.get(key);
            if (fieldType === "NUMBER") {
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                customFields[key] = parsed;
              }
              return;
            }
            customFields[key] = typeof value === "string" ? value : String(value);
          });
        }

        if (attributeMap.has("workingDir") && tplWorkingDirectory) {
          customFields.workingDir = tplWorkingDirectory;
        }

        if (Object.keys(customFields).length > 0) {
          appForm.setFieldsValue({ customFields });
        }
      }

      const clusterChanged = templateCluster !== clusterId;

      const tplDatasets = (cleanedFormData.datasets ?? []) as { id: number; isPrivate: boolean }[];
      const tplAlgorithms = (cleanedFormData.algorithms ?? []) as { id: number; isPrivate: boolean }[];
      const tplModels = (cleanedFormData.models ?? []) as { id: number; isPrivate: boolean }[];
      if (!clusterChanged && (tplDatasets.length || tplAlgorithms.length || tplModels.length)) {
        const [fetchedDatasets, fetchedAlgorithms, fetchedModels] = await Promise.all([
          tplDatasets.length
            ? trpcUtils.dataset.getAllDatasetVersions.fetch({ clusterId }).catch(() => undefined)
            : undefined,
          tplAlgorithms.length
            ? trpcUtils.algorithm.getAllAlgorithmVersions.fetch({ clusterId }).catch(() => undefined)
            : undefined,
          tplModels.length
            ? trpcUtils.model.getAllModelVersions.fetch({ clusterId }).catch(() => undefined)
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

      let finalImageSource: ImageSourceKey | undefined;
      let finalImageValue: string | undefined;

      if (clusterChanged) {
        // skip image backfill
      } else {
        const tplRemoteImageUrl = cleanedFormData.remoteImageUrl as string | undefined;
        const tplLocalImageName = cleanedFormData.localImageName as string | undefined;
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
        } else if (tplLocalImageName) {
          finalImageSource = "preset";
          finalImageValue = tplLocalImageName;
          imageSourceDraftsRef.current.preset = { image: tplLocalImageName };
          setSelectedImageSource("preset");
          appForm.setFieldsValue({ image: tplLocalImageName });
        } else if (tplIsImagePrivate === true || tplIsImagePrivate === false) {
          const imageSource = tplIsImagePrivate ? "mine" : "public";
          finalImageSource = imageSource;
          if (tplImageId != null) {
            const fetchedImages = await trpcUtils.image.list
              .fetch({
                isPublic: tplIsImagePrivate ? parseBooleanParam(false) : parseBooleanParam(true),
                clusterId,
                withExternal: "true",
                types: ImageType.APP,
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
        const tplStartCommand = cleanedFormData.startCommand as string | undefined;
        if (tplStartCommand) {
          appForm.setFieldsValue({ command: tplStartCommand });
          if (finalImageSource && finalImageValue) {
            const cacheKey = getCommandCacheKey(finalImageSource, finalImageValue);
            commandCacheRef.current[cacheKey] = { default: undefined, custom: tplStartCommand };
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

  // ======================= 渲染 =======================
  return (
    <>
      <JobPageHeader
        title={t(p("createAppTitle"), [effectiveAppName ?? ""])}
        backLabel={t(pJobDetails("return"))}
        onBack={handleCancel}
        logo={appLogoSrc ? <HeaderAvatar size={28} src={appLogoSrc} /> : null}
        action={
          <Button type="primary" onClick={() => setTemplateListOpen(true)}>
            {t(p("templateButton"))}
          </Button>
        }
      />
      <JobPageLayout>
        <JobMainContent>
          <JobContainer direction="vertical" size={0}>
            <div style={{ position: "relative" }}>
              <PaddedCard>
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
              queueTotalUnits={queueTotalUnits}
              gpuUnitLimit={gpuUnitLimit}
              qosOptions={qosOptions}
              maxTimeUnit={maxTimeUnit}
              onMaxTimeUnitChange={handleMaxTimeUnitChange}
              selectedPresetUnit={selectedPresetUnit}
              onSelectedPresetUnitChange={setSelectedPresetUnit}
              maxJobRunningTimeHours={maxJobRunningTimeHours}
              isResubmit={Boolean(createAppParams)}
            />

            <AppConfigSection
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
              customFormItems={customFormItems}
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
              {effectiveAppComment && (
                <>
                  <JobSidePanelScrollBox>
                    <AppCommentContainer>
                      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {getI18nConfigCurrentText(effectiveAppComment, languageId)}
                      </Markdown>
                    </AppCommentContainer>
                  </JobSidePanelScrollBox>
                  <SidePanelDivider />
                </>
              )}
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
                accountInfo={accountInfo ?? null}
              />
            </SidePanelGroupWrapper>
          </JobSidePanelInner>
        </JobSidePanel>
      </JobPageLayout>

      <FixedFooter>
        <div style={{ marginLeft: 208, marginRight: "auto" }}>
          <FooterStatValue
            $isPrimaryColor
            style={{ cursor: "pointer", userSelect: "none", textDecoration: "none" }}
            onClick={async () => {
              try {
                await resourceForm.validateFields();
                await appForm.validateFields();
                setTemplateSnapshot(buildAppTemplateFormData());
                setSaveTemplateOpen(true);
              } catch {
                message.warning(t(p("completeFormFirst")));
              }
            }}
          >
            {t(p("saveAsTemplate"))}
          </FooterStatValue>
        </div>
        <FooterActions>
          <Button onClick={handleCancel}>{t(p("cancel"))}</Button>
          <Button type="primary" onClick={handleSubmit} loading={createAppSessionMutation.isPending}>
            {t(p("submit"))}
          </Button>
        </FooterActions>
      </FixedFooter>
      <SaveAsTemplateModal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        jobType={JobType.APP}
        appId={appId}
        cluster={selectedCluster ?? ""}
        formData={templateSnapshot}
      />
      <TemplateListModal
        open={templateListOpen}
        onClose={() => setTemplateListOpen(false)}
        onUse={handleTemplateUse}
        jobType={JobType.APP}
        appId={appId}
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
