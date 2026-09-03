import type { ReactNode } from "react";
import type { AppTemplateDetail } from "src/pages/api/app/listAppTemplates";

import { FixedFooter, FooterActions, FooterStatValue } from "@scow/lib-web/build/components/job/Footer";
import { JobSideInfo } from "@scow/lib-web/build/components/job/JobSideInfo";
import {
  BorderlessCard,
  HeaderRow,
  HeaderTitle,
  PaddedCard,
} from "@scow/lib-web/build/components/styledAntdCom/DualTitleCard";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { BackIcon } from "@scow/lib-web/build/icons/commonIcons";
import {
  JobContainer,
  JobMainContent,
  JobPageLayout,
  JobSidePanel,
  JobSidePanelInner,
  JobSidePanelScrollBox,
} from "@scow/lib-web/build/layouts/base/JobContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Avatar, Button, Form } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import { join } from "path";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AccountUnavailableReason, ReservedAppAttributeName, TimeUnit } from "src/models/job";
import { Partition } from "src/pages/api/cluster";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { formatSize } from "src/utils/format";
import { styled, useTheme } from "styled-components";

import { MAX_TIME_PRESETS } from "../job/submitJobCom/ResourceConfigSection";
import { SaveAsTemplateModal } from "../job/submitJobCom/SaveAsTemplateModal";
import { AppTemplateListModal } from "./AppTemplateListModal";
import { AppConfigSection } from "./CreateAppCom/AppConfigSection";
import { AppResourceFormValues, FixedOrEditableFormItem } from "./CreateAppCom/FixedOrEditableFormItem";
import { ResourceConfigSection } from "./CreateAppCom/ResourceConfigSection";
import {
  getFixedValueListByAttributeName,
  getInitialFixedValueByAttributeName,
  getReservedAppAttributeConfig,
  getVisibleCustomTemplateFieldNames,
  getVisibleResourceTemplateFieldNames,
  isTemplateCustomAttributesAvailable,
  isTemplateResourceReservedConfigAvailable,
  normalizeResourceValuesByReservedConfig,
  templateCustomAttributesKey,
  templateResourceAttributesKey,
} from "./LauchAppFormUtils";

interface AccountAvailabilityInfo {
  accountName: string;
  available: boolean;
  unavailableReasons: number[];
}

interface App {
  id: string;
  name: string;
  logoPath?: string;
  availableAccounts?: string[];
  accountAvailabilities?: AccountAvailabilityInfo[];
}

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

const HeaderAvatar = styled(Avatar)`
  background-color: rgba(240, 240, 240, 1) !important;
`;

const SidePanelGroupWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const SidePanelDivider = styled.div`
  height: 1px;
  margin: 16px 0px;
  background: ${({ theme }) => theme.palette.gray[4]};
  flex-shrink: 0;
`;

export interface AccountOption {
  label: string;
  value: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface Props {
  appInfo: App | undefined;
  accountAppClusterMap: Map<string, string[]>;
  preSelectedCluster: string | undefined;
  setSelectedAppInfo: (value: App | undefined) => void;
  setSelectedCluster: (clusterId: string | undefined) => void;
}

interface FormFields {
  appJobName: string;
  partition: string | undefined;
  qos: string | undefined;
  nodeCount: number;
  coreCount: number;
  gpuCount: number | undefined;
  account: string;
  maxTime: number;
}

type PartitionTabKey = "cpu" | "gpu";

export interface PartitionRow {
  key: string;
  name: string;
  description: string;
  nodeSpecLines: ReactNode[];
  idleNodes: string;
  idleCpu: string;
  idleGpu: string;
  pendingJobs: string | number;
  kind: PartitionTabKey;
}

// 生成默认应用名称，命名规则为"当前应用名-年月日-时分秒"
const genAppJobName = (appName: string): string => {
  return `${appName}-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const p = prefix("pageComp.app.launchAppForm.");
const pCommon = prefix("common.");
const pResource = prefix("pageComp.submitJobCom.ResourceConfigSection.");

export const LaunchAppForm: React.FC<Props> = ({
  appInfo,
  accountAppClusterMap,
  preSelectedCluster,
  setSelectedAppInfo,
  setSelectedCluster,
}) => {
  const { id: appId, name: appName, logoPath: appLogoPath } = appInfo || { id: "", name: "" };
  const { currentClusters, fullClusterConfigs } = useStore(ClusterInfoStore);

  const { message, modal } = App.useApp();
  const { user } = useStore(UserStore);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const theme = useTheme();

  const [baseForm] = Form.useForm<FormFields>();
  const [resourceForm] = Form.useForm<AppResourceFormValues>();
  const [appForm] = Form.useForm<FormFields>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [activePartitionTab, setActivePartitionTab] = useState<PartitionTabKey>("cpu");

  const [maxTimeUnitValue, setMaxTimeUnitValue] = useState<TimeUnit>(TimeUnit.HOURS);
  const [selectedPresetUnit, setSelectedPresetUnit] = useState<TimeUnit | undefined>(TimeUnit.MINUTES);
  const [pendingTemplatePartition, setPendingTemplatePartition] = useState<string | undefined>();
  const [pendingTemplateQos, setPendingTemplateQos] = useState<string | undefined>();
  const [expiredTemplate, setExpiredTemplate] = useState<{ id: number; templateName: string } | undefined>();
  const [deletingExpiredTemplate, setDeletingExpiredTemplate] = useState(false);
  const [templateRefreshSignal, setTemplateRefreshSignal] = useState(0);

  const selectedAccount = Form.useWatch("account", resourceForm);
  const selectedCluster = Form.useWatch<string>("cluster", resourceForm);
  const selectedPartition = Form.useWatch("partition", resourceForm);
  const selectedQos = Form.useWatch<string | undefined>("qos", resourceForm);
  const nodeCount = Form.useWatch("nodeCount", resourceForm);
  const coreCount = Form.useWatch("coreCount", resourceForm);
  const gpuCount = Form.useWatch("gpuCount", resourceForm);
  const selectedMaxTime = Form.useWatch<number | undefined>("maxTime", resourceForm);
  const maxRunningTimeHours = selectedCluster
    ? fullClusterConfigs[selectedCluster]?.hpc?.app?.maxRunningTimeHours
    : undefined;

  const router = useRouter();

  // 获取应用信息
  const { data: appMetadataResult } = useAsync({
    promiseFn: useCallback(async () => {
      if (selectedCluster) {
        const result = await api
          .getAppMetadata({ query: { appId, cluster: selectedCluster } })
          .httpError(404, () => {
            message.error(t("pages.apps.create.error404"));
          })
          .httpError(500, (e) => {
            if (e.code === "APP_CONFIG_ERROR") {
              message.error(e.error);
            } else {
              throw e;
            }
          });
        return { cluster: selectedCluster, ...result };
      }
    }, [appId, selectedCluster]),
  });

  // 只有当返回数据对应当前选中集群时才使用，避免切换集群期间使用旧集群的配置
  // 如果没有选择集群直接返回appMetadataResult
  const appMetadata =
    !selectedCluster || appMetadataResult?.cluster === selectedCluster ? appMetadataResult : undefined;

  const { appComment, appCustomFormAttributes: attributes = [], reservedAppAttributes } = appMetadata ?? {};
  const ignoreGpu = appMetadata?.ignoreGpu ?? false;

  const appCommentI18nText = appComment ? getI18nConfigCurrentText(appComment, languageId) : undefined;

  // 判断系统保留APP字段:账户及分区或qos 是否已配置为固定值字段
  const fixedPartitionName = getInitialFixedValueByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.PARTITION,
  );
  const fixedQosName = getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.QOS);

  const fixedNodeCountValue = getInitialFixedValueByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.NODE_COUNT,
  );
  const fixedCoreCountValue = getInitialFixedValueByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.CORE_COUNT,
  );
  const fixedGpuCountValue = getInitialFixedValueByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.GPU_COUNT,
  );
  // 判断系统保留APP字段是否配置为了固定值选项
  const fixedAccountList = getFixedValueListByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.ACCOUNT,
  ).map((x) => x.toString());
  const fixedPartitionList = getFixedValueListByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.PARTITION,
  ).map((x) => x.toString());

  const fixedMaxTimeValue = getInitialFixedValueByAttributeName(
    reservedAppAttributes,
    ReservedAppAttributeName.MAX_TIME,
  );

  const initialValues = {
    nodeCount: fixedNodeCountValue ? parseInt(fixedNodeCountValue, 10) : 1,
    coreCount: fixedCoreCountValue ? parseInt(fixedCoreCountValue, 10) : 1,
    gpuCount: fixedGpuCountValue ? parseInt(fixedGpuCountValue, 10) : 1,
    maxTime: fixedMaxTimeValue ? parseInt(fixedMaxTimeValue, 10) : 30,
  } as Partial<FormFields>;

  const validateResourceFormWithReservedConfig = useCallback(async () => {
    const normalizedCurrentValues = normalizeResourceValuesByReservedConfig(
      resourceForm.getFieldsValue(),
      reservedAppAttributes,
    );
    resourceForm.setFieldsValue(normalizedCurrentValues);

    const validatedValues = await resourceForm.validateFields();
    return normalizeResourceValuesByReservedConfig(validatedValues, reservedAppAttributes);
  }, [resourceForm, reservedAppAttributes]);

  // 获取集群运行信息，分区空闲资源与 dashboard 保持同一口径
  const clusterRunningInfoQuery = useAsync({
    promiseFn: useCallback(async () => {
      if (!selectedCluster) {
        return undefined;
      }
      return await api
        .getClusterRunningInfo({
          query: {
            clusterId: selectedCluster,
          },
        })
        .httpError(500, () => undefined);
    }, [selectedCluster]),
  });

  // 获取账户的可见分区
  const availablePartitionsForAccountQuery = useAsync({
    promiseFn: useCallback(async () => {
      if (selectedCluster && selectedAccount) {
        const result = await api.getAvailablePartitionsForCluster({
          query: {
            cluster: selectedCluster,
            accountName: selectedAccount,
          },
        });
        return {
          cluster: selectedCluster,
          accountName: selectedAccount,
          partitions: result.partitions,
        };
      }
      return {
        cluster: selectedCluster,
        accountName: selectedAccount,
        partitions: [] as Partition[],
      };
    }, [selectedAccount, selectedCluster]),
  });

  const accountInfoQuery = useAsync({
    promiseFn: useCallback(async () => {
      if (!selectedAccount) {
        return undefined;
      }
      return api.getAccountInfo({ query: { accountName: selectedAccount } }).catch(() => undefined);
    }, [selectedAccount]),
  });

  const partitionRows: PartitionRow[] = useMemo(() => {
    if (!selectedCluster || !selectedAccount) {
      return [];
    }
    const hasMatchedPartitionData =
      !availablePartitionsForAccountQuery.isLoading &&
      availablePartitionsForAccountQuery.data?.cluster === selectedCluster &&
      availablePartitionsForAccountQuery.data?.accountName === selectedAccount;
    const partitions = hasMatchedPartitionData ? (availablePartitionsForAccountQuery.data?.partitions ?? []) : [];
    const summaryPartitions = clusterRunningInfoQuery.data?.clusterInfo.partitions ?? [];

    const partitionsInfo = partitions.map((partition) => {
      const summary = summaryPartitions.find((item) => item.partitionName === partition.name);
      const nodeTotal = summary?.nodeCount;
      const perNodeDivisor = nodeTotal && nodeTotal > 0 ? nodeTotal : 1;
      const nodeSpecParts = [
        !ignoreGpu && partition.gpus ? t(pResource("nodeSpecGpu"), [partition.gpus / perNodeDivisor]) : undefined,
        partition.cores ? t(pResource("nodeSpecCpu"), [partition.cores / perNodeDivisor]) : undefined,
        partition.memMb
          ? t(pResource("nodeSpecMemory"), [formatSize(partition.memMb / perNodeDivisor, ["MB", "GB", "TB"])])
          : undefined,
      ].filter(Boolean);
      const cpuTotal = summary?.cpuCoreCount;
      const gpuTotal = summary?.gpuCoreCount;
      const idleNodeCount = summary?.idleNodeCount;
      const idleCpuCount = summary?.idleCpuCount;
      const idleGpuCount = summary?.idleGpuCount;
      const idleNodes = nodeTotal != null && idleNodeCount != null ? `${idleNodeCount}/${nodeTotal}` : "-";
      const idleCpu = cpuTotal != null && idleCpuCount != null ? `${idleCpuCount}/${cpuTotal}` : "-";
      const idleGpu = gpuTotal != null && idleGpuCount != null ? `${idleGpuCount}/${gpuTotal}` : "-";
      const kind: PartitionTabKey = !ignoreGpu && partition.gpus && partition.gpus > 0 ? "gpu" : "cpu";
      const disabled =
        kind === "gpu"
          ? idleGpuCount != null
            ? idleGpuCount <= 0
            : false
          : idleCpuCount != null
            ? idleCpuCount <= 0
            : false;

      return {
        key: partition.name ?? "-",
        name: partition.name ?? "-",
        description: partition.description ?? "-",
        nodeSpecLines: nodeSpecParts.length ? nodeSpecParts : ["-"],
        disabled,
        idleNodes,
        idleCpu,
        idleGpu,
        pendingJobs: summary?.pendingJobCount ?? "-",
        kind,
      };
    });

    // 如果配置分区选项，按照配置的优先级展示分区信息
    if (fixedPartitionList.length > 0) {
      const result = fixedPartitionList.map((partitionName) => {
        const foundPartition = partitionsInfo.find((item) => item.name === partitionName);

        if (foundPartition) {
          return foundPartition;
        } else {
          return {
            name: partitionName,
            key: partitionName,
            description: "-",
            nodeSpecLines: ["-"],
            pendingJobs: "-",
            idleNodes: "-",
            idleCpu: "-",
            idleGpu: "-",
            kind: "cpu" as const, // 默认为 cpu
          };
        }
      });
      return result;
    }

    return partitionsInfo;
  }, [
    availablePartitionsForAccountQuery.isLoading,
    availablePartitionsForAccountQuery.data?.accountName,
    availablePartitionsForAccountQuery.data?.cluster,
    availablePartitionsForAccountQuery.data?.partitions,
    clusterRunningInfoQuery.data?.clusterInfo.partitions,
    ignoreGpu,
    languageId,
    selectedAccount,
    selectedCluster,
  ]);

  useEffect(() => {
    if (fixedPartitionList.length > 0 || partitionRows.length === 0) {
      return;
    }

    const hasCpuPartition = partitionRows.some((p) => p.kind === "cpu");
    const hasGpuPartition = partitionRows.some((p) => p.kind === "gpu");

    setActivePartitionTab((current) => {
      if (current === "cpu" && !hasCpuPartition && hasGpuPartition) {
        return "gpu";
      } else if (current === "gpu" && !hasGpuPartition && hasCpuPartition) {
        return "cpu";
      }
      return current;
    });
  }, [fixedPartitionList.length, partitionRows]);

  const accountReasonTextMap = useMemo<Record<number, string>>(
    () => ({
      [AccountUnavailableReason.USER_BLOCKED]: t(p("accountUserBlocked")),
      [AccountUnavailableReason.ACCOUNT_FROZEN]: t(p("accountFrozen")),
      [AccountUnavailableReason.ACCOUNT_BLOCKED]: t(p("accountBlocked")),
      [AccountUnavailableReason.ACCOUNT_DEBT]: t(p("accountDebt")),
      [AccountUnavailableReason.USER_QUOTA_EXCEEDED]: t(p("userQuotaExceeded")),
    }),
    [t],
  );

  const accountOptions = useMemo((): AccountOption[] => {
    if (fixedAccountList.length > 0) {
      return fixedAccountList.map((account) => ({ label: account, value: account }));
    }

    const appAccountAvailabilities = appInfo?.accountAvailabilities ?? [];

    return appAccountAvailabilities
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.accountName.localeCompare(b.accountName);
      })
      .map((info) => ({
        label: info.accountName,
        value: info.accountName,
        disabled: !info.available,
        disabledReason: info.available
          ? undefined
          : (info.unavailableReasons ?? []).map((reason) => accountReasonTextMap[reason] ?? reason).join("；"),
      }));
  }, [appInfo?.accountAvailabilities, fixedAccountList, accountReasonTextMap]);

  const clusterName = useMemo(() => {
    const cluster = currentClusters.find((c) => c.id === preSelectedCluster);
    return cluster ? getI18nConfigCurrentText(cluster.name, languageId) : preSelectedCluster;
  }, [currentClusters, preSelectedCluster, languageId]);

  const qosOptions = useMemo(() => {
    if (!selectedPartition) {
      return [];
    }
    const hasMatchedPartitionData =
      !availablePartitionsForAccountQuery.isLoading &&
      availablePartitionsForAccountQuery.data?.cluster === selectedCluster &&
      availablePartitionsForAccountQuery.data?.accountName === selectedAccount;
    const partitions = hasMatchedPartitionData ? (availablePartitionsForAccountQuery.data?.partitions ?? []) : [];
    return partitions.find((partition) => partition.name === selectedPartition)?.qos ?? [];
  }, [
    availablePartitionsForAccountQuery.isLoading,
    availablePartitionsForAccountQuery.data?.accountName,
    availablePartitionsForAccountQuery.data?.cluster,
    availablePartitionsForAccountQuery.data?.partitions,
    selectedAccount,
    selectedCluster,
    selectedPartition,
  ]);

  const selectedPartitionInfo = useMemo(() => {
    if (!selectedPartition) {
      return undefined;
    }
    const hasMatchedPartitionData =
      !availablePartitionsForAccountQuery.isLoading &&
      availablePartitionsForAccountQuery.data?.cluster === selectedCluster &&
      availablePartitionsForAccountQuery.data?.accountName === selectedAccount;
    const partitions = hasMatchedPartitionData ? (availablePartitionsForAccountQuery.data?.partitions ?? []) : [];
    return partitions.find((partition) => partition.name === selectedPartition);
  }, [
    availablePartitionsForAccountQuery.isLoading,
    availablePartitionsForAccountQuery.data?.accountName,
    availablePartitionsForAccountQuery.data?.cluster,
    availablePartitionsForAccountQuery.data?.partitions,
    selectedAccount,
    selectedCluster,
    selectedPartition,
  ]);
  const currentPartitionIsWithGpu = !ignoreGpu && !!selectedPartitionInfo?.gpus;
  const currentPartitionInfoForForm = useMemo(
    () => (ignoreGpu && selectedPartitionInfo ? { ...selectedPartitionInfo, gpus: 0 } : selectedPartitionInfo),
    [ignoreGpu, selectedPartitionInfo],
  );

  const inputsDisabled = !selectedPartitionInfo;

  const totalGpuCount = useMemo(() => {
    if (!selectedPartitionInfo) {
      return "-";
    }
    if (activePartitionTab !== "gpu") {
      return 0;
    }
    const gpuPerNode = gpuCount ?? 0;
    const nodes = nodeCount ?? 0;
    return gpuPerNode * nodes;
  }, [activePartitionTab, gpuCount, nodeCount, selectedPartitionInfo]);

  const totalCpuCount = useMemo(() => {
    const nodes = nodeCount ?? 0;
    if (!nodes || !selectedPartitionInfo) {
      return "-";
    }
    if (activePartitionTab === "gpu") {
      const gpuPerNode = gpuCount ?? 0;
      const coresPerGpu = selectedPartitionInfo.gpus
        ? Math.floor(selectedPartitionInfo.cores / selectedPartitionInfo.gpus)
        : 0;
      return gpuPerNode && coresPerGpu ? `${nodes * gpuPerNode * coresPerGpu}` : "-";
    }
    const cpuPerNode = coreCount ?? 0;
    return cpuPerNode ? `${nodes * cpuPerNode}` : "-";
  }, [activePartitionTab, coreCount, gpuCount, nodeCount, selectedPartitionInfo]);

  const totalMemoryMb = useMemo(() => {
    if (!selectedPartitionInfo || !nodeCount) {
      return undefined;
    }
    const memPerCore = Math.floor(selectedPartitionInfo.memMb / selectedPartitionInfo.cores);
    if (activePartitionTab === "gpu") {
      const gpuPerNode = gpuCount ?? 0;
      const coresPerGpu = selectedPartitionInfo.gpus
        ? Math.floor(selectedPartitionInfo.cores / selectedPartitionInfo.gpus)
        : 0;
      const memorySize = nodeCount * gpuPerNode * coresPerGpu * memPerCore;
      return memorySize > 0 ? memorySize : undefined;
    }
    const cpuPerNode = coreCount ?? 0;
    const memorySize = nodeCount * cpuPerNode * memPerCore;
    return memorySize > 0 ? memorySize : undefined;
  }, [activePartitionTab, coreCount, gpuCount, nodeCount, selectedPartitionInfo]);

  const totalMemory = totalMemoryMb !== undefined ? formatSize(totalMemoryMb, ["MB", "GB", "TB"]) : "-";

  const timeSecondsForPrice = 3600;

  const { data: jobOneHourPrice } = useAsync({
    promiseFn: useCallback(async () => {
      if (!selectedAccount || !selectedCluster || !selectedPartition || !selectedQos || !selectedPartitionInfo) {
        return undefined;
      }
      const nodes = nodeCount ?? 0;
      if (!nodes) {
        return undefined;
      }

      if (activePartitionTab === "gpu") {
        const gpuPerNode = gpuCount ?? 0;
        if (!gpuPerNode) {
          return undefined;
        }
        const coresPerGpu = selectedPartitionInfo.gpus
          ? Math.floor(selectedPartitionInfo.cores / selectedPartitionInfo.gpus)
          : 0;
        const memPerCore = Math.floor(selectedPartitionInfo.memMb / selectedPartitionInfo.cores);
        const cpusAlloc = nodes * gpuPerNode * coresPerGpu;
        const memMbForQuery = cpusAlloc * memPerCore;
        const response = await api.calculateJobPrice({
          query: {
            cluster: selectedCluster,
            partition: selectedPartition,
            accountName: selectedAccount,
            qos: selectedQos,
            gpu: nodes * gpuPerNode,
            cpusAlloc,
            memMb: memMbForQuery,
            timeSeconds: timeSecondsForPrice,
          },
        });
        return response.accountPrice;
      }

      const cpuPerNode = coreCount ?? 0;
      if (!cpuPerNode) {
        return undefined;
      }
      const memPerCore = Math.floor(selectedPartitionInfo.memMb / selectedPartitionInfo.cores);
      const cpusAlloc = nodes * cpuPerNode;
      const memMbForQuery = cpusAlloc * memPerCore;
      const response = await api.calculateJobPrice({
        query: {
          cluster: selectedCluster,
          partition: selectedPartition,
          accountName: selectedAccount,
          qos: selectedQos,
          gpu: 0,
          cpusAlloc,
          memMb: memMbForQuery,
          timeSeconds: timeSecondsForPrice,
        },
      });
      return response.accountPrice;
    }, [
      activePartitionTab,
      selectedAccount,
      selectedCluster,
      coreCount,
      gpuCount,
      nodeCount,
      selectedPartition,
      selectedPartitionInfo,
      selectedQos,
    ]),
  });

  const formattedHourlyPrice = jobOneHourPrice == null ? "-" : jobOneHourPrice.toFixed(2);

  const createErrorModal = (message: string) =>
    modal.error({
      title: t(p("errorMessage")),
      okText: t("button.confirmButton"),
      content: formatErrorMsg(message),
    });

  function formatErrorMsg(logText: string) {
    const detailsRegex = /Details\s*:\s*([\s\S]*)$/i;
    const match = detailsRegex.exec(logText);

    if (match?.[1]) {
      return match[1].trim();
    }
    return logText;
  }

  const handleGoBack = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const callbackPath = searchParams.get("callbackPath");
    if (callbackPath) {
      window.location.href = callbackPath;
    } else {
      setSelectedAppInfo(undefined);
    }
  }, [setSelectedAppInfo]);

  const handleSaveAsTemplate = async (templateName: string) => {
    if (savingTemplate || isSubmitting) return;

    const resourceValues = await validateResourceFormWithReservedConfig();
    const appFormFields = await appForm.validateFields();

    const customFormKeyValue: Record<string, string> = {};
    attributes.forEach((attr) => {
      if (attr.fixedValue?.hidden) {
        return;
      }

      const key = attr.name;
      customFormKeyValue[key] = appFormFields[key];
    });
    customFormKeyValue[templateResourceAttributesKey] = JSON.stringify(
      getVisibleResourceTemplateFieldNames(reservedAppAttributes),
    );
    customFormKeyValue[templateCustomAttributesKey] = JSON.stringify(getVisibleCustomTemplateFieldNames(attributes));
    const templateGpuCount = ignoreGpu ? undefined : resourceValues.gpuCount;

    try {
      setSavingTemplate(true);
      await api
        .saveAsAppTemplate({
          body: {
            cluster: selectedCluster,
            templateName,
            account: resourceValues.account,
            partition: resourceValues.partition,
            qos: resourceValues.qos,
            nodeCount: resourceValues.nodeCount ?? 1,
            coreCount: templateGpuCount
              ? templateGpuCount * Math.floor((selectedPartitionInfo?.cores ?? 1) / (selectedPartitionInfo?.gpus ?? 1))
              : (resourceValues.coreCount ?? 1),
            gpuCount: templateGpuCount ?? 0,
            memoryMb: totalMemoryMb,
            maxTime: resourceValues.maxTime ?? 60,
            maxTimeUnit: selectedPresetUnit ?? maxTimeUnitValue,
            appId,
            customAttributes: JSON.stringify(customFormKeyValue),
          },
        })
        .httpError(409, () => {
          message.error(t(p("templateNameExists")));
          throw new Error("ALREADY_EXISTS");
        })
        .then(() => {
          message.success(t(p("saveTemplateSuccess")));
        });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleOpenSaveTemplateModal = async () => {
    if (savingTemplate || isSubmitting) return;
    try {
      await validateResourceFormWithReservedConfig();
      await appForm.validateFields();
      setSaveModalOpen(true);
    } catch {
      message.warning(t(p("completeRequiredInfo")));
    }
  };

  const showTemplateExpiredConfirm = (template: AppTemplateDetail) => {
    setExpiredTemplate({ id: template.id, templateName: template.templateName });
  };

  const handleDeleteExpiredTemplate = async () => {
    if (!expiredTemplate) return;
    setDeletingExpiredTemplate(true);
    await api
      .deleteAppTemplate({ query: expiredTemplate })
      .then(() => {
        message.success(t(p("templateDeleteSuccess")));
        setExpiredTemplate(undefined);
        setTemplateRefreshSignal((prev) => prev + 1);
      })
      .catch(() => {
        message.error(t(p("templateDeleteFailed")));
      })
      .finally(() => {
        setDeletingExpiredTemplate(false);
      });
  };

  const handleUseTemplate = async (template: AppTemplateDetail) => {
    const accountAvailable =
      template.account && accountOptions.some((o) => o.value === template.account && !o.disabled);
    if (!accountAvailable) {
      showTemplateExpiredConfirm(template);
      return;
    }

    const validClustersForAccount =
      template.account && appId
        ? new Set(accountAppClusterMap.get(`${template.account}::${appId}`) ?? [])
        : new Set<string>();

    if (template.cluster && !validClustersForAccount.has(template.cluster)) {
      showTemplateExpiredConfirm(template);
      return;
    }

    const cluster = template.cluster || selectedCluster;
    const targetCluster = template.cluster ?? selectedCluster;
    let targetAttributes = attributes;
    let targetIgnoreGpu = ignoreGpu;
    if (targetCluster && targetCluster !== selectedCluster) {
      try {
        const meta = await api.getAppMetadata({ query: { appId, cluster: targetCluster } });
        targetAttributes = meta.appCustomFormAttributes ?? [];
        targetIgnoreGpu = meta.ignoreGpu ?? false;
      } catch {
        /* fall back to current app metadata */
      }
    }

    let matchedPartition: Partition | undefined;
    if (template.partition && template.account && cluster) {
      const availablePartitions = await api
        .getAvailablePartitionsForCluster({
          query: { cluster, accountName: template.account },
        })
        .then((res) => res.partitions)
        .catch(() => undefined);

      matchedPartition = availablePartitions?.find((p) => p.name === template.partition);
      if (!matchedPartition) {
        showTemplateExpiredConfirm(template);
        return;
      }

      if (template.qos && !(matchedPartition.qos ?? []).includes(template.qos)) {
        showTemplateExpiredConfirm(template);
        return;
      }
    }

    if (matchedPartition) {
      if (template.nodeCount > matchedPartition.nodes) {
        showTemplateExpiredConfirm(template);
        return;
      }
      const useGpu = !targetIgnoreGpu && (matchedPartition.gpus ?? 0) > 0;
      if (useGpu && template.gpuCount && template.gpuCount > matchedPartition.gpus) {
        showTemplateExpiredConfirm(template);
        return;
      }
      if (!useGpu && template.coreCount > matchedPartition.cores) {
        showTemplateExpiredConfirm(template);
        return;
      }
    }

    const templatePartitionIsWithGpu =
      !targetIgnoreGpu && (matchedPartition ? !!matchedPartition.gpus : !!template.gpuCount);
    if (!isTemplateResourceReservedConfigAvailable(template, reservedAppAttributes, templatePartitionIsWithGpu)) {
      showTemplateExpiredConfirm(template);
      return;
    }

    const useGpuTab =
      !targetIgnoreGpu &&
      (matchedPartition ? (matchedPartition.gpus ?? 0) > 0 : !!template.gpuCount && template.gpuCount > 0);

    if (!isTemplateCustomAttributesAvailable(template.customAttributes, targetAttributes)) {
      showTemplateExpiredConfirm(template);
      return;
    }

    const nextValues: Partial<AppResourceFormValues & FormFields> = {
      account: template.account,
      cluster: template.cluster,
      partition: template.partition,
      qos: template.qos,
      nodeCount: template.nodeCount,
      maxTime: template.maxTime,
    };
    if (useGpuTab) {
      nextValues.gpuCount = template.gpuCount;
      nextValues.coreCount = undefined;
    } else {
      nextValues.coreCount = template.coreCount;
      nextValues.gpuCount = undefined;
    }

    setActivePartitionTab(useGpuTab ? "gpu" : "cpu");
    setPendingTemplatePartition(template.partition);
    setPendingTemplateQos(template.qos);
    resourceForm.setFieldsValue(nextValues);
    const templateMaxTimeUnit = template.maxTimeUnit ?? TimeUnit.MINUTES;
    const matchedMaxTimePreset = MAX_TIME_PRESETS.find(
      (preset) => preset.maxTime === template.maxTime && preset.maxTimeUnit === templateMaxTimeUnit,
    );
    setMaxTimeUnitValue(templateMaxTimeUnit);
    setSelectedPresetUnit(matchedMaxTimePreset?.maxTimeUnit);
    if (template.customAttributes) {
      try {
        const parsed = JSON.parse(template.customAttributes) as Record<string, string>;
        const validated: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (key === templateResourceAttributesKey || key === templateCustomAttributesKey) {
            continue;
          }

          const attrDef = targetAttributes.find((a) => a.name === key);
          if (
            attrDef &&
            (attrDef.type === "SELECT" || attrDef.type === "COMMAND_SELECT") &&
            attrDef.select.length > 0
          ) {
            const available = attrDef.select.map((opt) => opt.value);
            validated[key] = available.includes(value) ? value : available[0];
          } else {
            validated[key] = value;
          }
        }
        appForm.setFieldsValue(validated);
      } catch {
        /* ignore parse errors */
      }
    }
    setTemplateListOpen(false);
  };

  const handleSubmit = async () => {
    const baseFormFields = await baseForm.validateFields();
    const resourceFormFields = await validateResourceFormWithReservedConfig();
    const appFormFields = await appForm.validateFields();
    const allFormFields = { ...baseFormFields, ...resourceFormFields, ...appFormFields };
    const { appJobName, nodeCount, coreCount, gpuCount, partition, qos, account, maxTime } = allFormFields;
    const submitGpuCount = ignoreGpu ? undefined : gpuCount;

    const customFormKeyValue: Record<string, string> = {};
    attributes.forEach((customFormAttribute) => {
      const customFormKey = customFormAttribute.name;
      customFormKeyValue[customFormKey] = allFormFields[customFormKey];
    });

    setIsSubmitting(true);
    await api
      .createAppSession({
        body: {
          cluster: selectedCluster,
          appId,
          appName: appName || "",
          appJobName: appJobName,
          nodeCount: nodeCount,
          coreCount: submitGpuCount
            ? submitGpuCount * Math.floor(selectedPartitionInfo!.cores / selectedPartitionInfo!.gpus)
            : coreCount,
          gpuCount: submitGpuCount,
          memoryMb: totalMemoryMb,
          partition,
          qos,
          account,
          maxTime: transformTime(maxTime, selectedPresetUnit ?? maxTimeUnitValue),
          customAttributes: customFormKeyValue,
        },
      })
      .httpError(500, (e) => {
        if (e?.code === "SBATCH_FAILED") {
          createErrorModal(e.message);
        } else if (e) {
          throw e;
        } else {
          message.error(t(pCommon("finalError")));
        }
      })
      .httpError(403, (e) => {
        if (e.code === "USER_ACCOUNT_NOT_AVAILABLE") {
          createErrorModal(t("pages.common.userAccountNotAvailableWhenSubmit", [user?.identityId, account]));
        } else if (e.code === "CLUSTER_PARTITION_NOT_AVAILABLE") {
          const clusterName = getI18nConfigCurrentText(
            currentClusters.find((cluster) => cluster.id == selectedCluster)?.name ?? selectedCluster,
            languageId,
          );
          createErrorModal(t("pages.common.clusterPartitionNotAvailableForAccount", [account, clusterName, partition]));
        } else if (e.code === "APP_NOT_AVAILABLE") {
          createErrorModal(t("pages.common.appNotAvailableForAccount", [account, appId]));
        } else {
          throw e;
        }
      })
      .httpError(404, (e) => {
        if (e.code === "APP_NOT_FOUND") {
          createErrorModal(t("pages.common.appNotFound", [appId]));
        } else {
          throw e;
        }
      })
      .httpError(400, (e) => {
        if (e.code === "INVALID_INPUT") {
          createErrorModal(e.message);
        } else {
          message.error(t(pCommon("invalidParameter")));
        }
      })
      .httpError(429, () => {
        message.error(t(pCommon("noSpaceError")));
      })
      .then(() => {
        message.success(t(p("successMessage")));
        const searchParams = new URLSearchParams(window.location.search);
        const callbackPath = searchParams.get("callbackPath");

        if (callbackPath) {
          window.location.href = callbackPath;
        } else {
          router.push("/apps/sessions");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const transformTime = (amount: number, unit: TimeUnit) => {
    switch (unit) {
      case TimeUnit.HOURS:
        return amount * 60;
      case TimeUnit.DAYS:
        return amount * 60 * 24;
      default:
        return amount;
    }
  };

  useEffect(() => {
    if (selectedCluster) {
      resourceForm.setFieldValue("cluster", selectedCluster);
      setSelectedCluster(selectedCluster);
      baseForm.setFieldValue("appJobName", genAppJobName(appName || ""));
    }
  }, [baseForm, selectedCluster]);

  useEffect(() => {
    if (!selectedPartitionInfo) {
      return;
    }
    const nodeCountNotSet = nodeCount === undefined || nodeCount === null;
    if (nodeCountNotSet && !resourceForm.isFieldTouched("nodeCount")) {
      const storeNodeCount = resourceForm.getFieldValue("nodeCount");
      if (storeNodeCount === undefined || storeNodeCount === null) {
        resourceForm.setFieldValue("nodeCount", initialValues.nodeCount ?? 1);
      }
    }

    if (activePartitionTab === "gpu") {
      if (gpuCount === undefined || gpuCount === null) {
        const storeGpuCount = resourceForm.getFieldValue("gpuCount");
        if (storeGpuCount === undefined || storeGpuCount === null || storeGpuCount === 0) {
          resourceForm.setFieldValue("gpuCount", 1);
        }
      }
    } else {
      if (coreCount === undefined || coreCount === null) {
        const storeCoreCount = resourceForm.getFieldValue("coreCount");
        if (storeCoreCount === undefined || storeCoreCount === null || storeCoreCount === 0) {
          resourceForm.setFieldValue("coreCount", 1);
        }
      }
    }
  }, [activePartitionTab, resourceForm, selectedPartitionInfo]);

  useEffect(() => {
    const maxTimeNotSet = selectedMaxTime === undefined || selectedMaxTime === null;
    if (maxTimeNotSet && !resourceForm.isFieldTouched("maxTime")) {
      resourceForm.setFieldValue("maxTime", initialValues.maxTime ?? 30);
    }
  }, [resourceForm, selectedMaxTime]);

  const availableAccountOptions = useMemo(() => accountOptions.filter((o) => !o.disabled), [accountOptions]);

  const hasAvailableAccount = useMemo(() => {
    if (!fixedAccountList.length) return availableAccountOptions.length > 0;

    const availableAccountNames = new Set(
      appInfo?.accountAvailabilities?.filter((account) => account.available).map((account) => account.accountName),
    );
    return fixedAccountList.some((account) => availableAccountNames.has(account));
  }, [appInfo?.accountAvailabilities, availableAccountOptions.length, fixedAccountList]);

  useEffect(() => {
    if (!accountOptions.length) return;
    if (selectedAccount && fixedAccountList.length) return;
    const currentAccount = resourceForm.getFieldValue("account");
    if (currentAccount && availableAccountOptions.some((o) => o.value === currentAccount)) return;

    resourceForm.setFieldValue("account", availableAccountOptions[0]?.value);
  }, [accountOptions, availableAccountOptions, resourceForm, fixedAccountList]);

  useEffect(() => {
    if (!partitionRows.length) return;
    if (pendingTemplatePartition) return;

    const currentPartition = resourceForm.getFieldValue("partition");
    const hasSelection = currentPartition && partitionRows.some((row) => row.key === currentPartition);
    if (hasSelection) return;

    const rowsInTab = partitionRows.filter((row) => row.kind === activePartitionTab);
    if (!rowsInTab.length) return;

    if (fixedPartitionName) {
      resourceForm.setFieldValue("partition", fixedPartitionName);
    } else {
      resourceForm.setFieldValue("partition", rowsInTab[0]?.key);
    }
  }, [activePartitionTab, fixedPartitionName, partitionRows, pendingTemplatePartition, resourceForm]);

  // 当分区通过固定选项下拉框选择时，同步 activePartitionTab
  useEffect(() => {
    if (!selectedPartition || !partitionRows.length) return;
    const row = partitionRows.find((r) => r.key === selectedPartition);

    if (row && row.kind !== activePartitionTab) {
      setActivePartitionTab(row.kind);
    }
  }, [selectedPartition, partitionRows]);

  useEffect(() => {
    resourceForm.setFieldValue("cluster", preSelectedCluster);
  }, [preSelectedCluster, resourceForm]);

  useEffect(() => {
    resourceForm.setFieldsValue(
      normalizeResourceValuesByReservedConfig(resourceForm.getFieldsValue(), reservedAppAttributes),
    );
  }, [resourceForm, reservedAppAttributes]);

  // 单位或配置上限变化时触发校验，让用户看到最新提示
  useEffect(() => {
    const currentValue = resourceForm.getFieldValue("maxTime");
    if (currentValue !== undefined && currentValue !== null) {
      resourceForm.validateFields(["maxTime"]);
    }
  }, [maxTimeUnitValue, maxRunningTimeHours, resourceForm, selectedPresetUnit]);

  useEffect(() => {
    if (!pendingTemplatePartition) return;
    if (partitionRows.some((row) => row.key === pendingTemplatePartition)) {
      resourceForm.setFieldValue("partition", pendingTemplatePartition);
      setPendingTemplatePartition(undefined);
    }
  }, [partitionRows, pendingTemplatePartition, resourceForm]);

  useEffect(() => {
    if (fixedQosName) return;
    if (!qosOptions.length) {
      if (!pendingTemplateQos) {
        resourceForm.setFieldValue("qos", undefined);
      }
      return;
    }
    if (pendingTemplateQos) {
      if (qosOptions.includes(pendingTemplateQos)) {
        resourceForm.setFieldValue("qos", pendingTemplateQos);
      }
      setPendingTemplateQos(undefined);
      return;
    }
    if (!selectedQos || !qosOptions.includes(selectedQos)) {
      resourceForm.setFieldValue("qos", qosOptions[0]);
    }
  }, [fixedQosName, pendingTemplateQos, qosOptions, resourceForm, selectedQos]);

  return (
    <>
      <JobPageLayout>
        <JobMainContent>
          <JobContainer direction="vertical" size={0}>
            <div style={{ position: "relative" }}>
              <BackIcon
                onClick={handleGoBack}
                style={{
                  position: "absolute",
                  left: 21,
                  top: 38,
                  cursor: "pointer",
                  fontSize: 20,
                  zIndex: 1,
                }}
              />
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
                    <HeaderRow align="center" size={16}>
                      {appLogoPath ? (
                        <HeaderAvatar size={32} src={join(publicConfig.PUBLIC_PATH, appLogoPath)} />
                      ) : null}
                      <HeaderTitle>{t(p("create")) + appName}</HeaderTitle>
                    </HeaderRow>
                    <Button type="link" style={{ padding: 0, fontSize: 16 }} onClick={() => setTemplateListOpen(true)}>
                      {t(p("templateButton"))}
                    </Button>
                  </HeaderRow>
                }
              >
                <BorderlessCard $showDivider title={<SectionTitle>{t(p("basicInfoSectionTitle"))}</SectionTitle>}>
                  <Form form={baseForm} colon={false} requiredMark={false}>
                    <FixedOrEditableFormItem
                      form={baseForm}
                      languageId={languageId}
                      t={t}
                      name="appJobName"
                      label={<FormLabel>{t(p("appJobName"))}</FormLabel>}
                      rules={[{ required: true, message: t(p("jobNameRequired")) }, { max: 50 }]}
                      reservedConfig={getReservedAppAttributeConfig(
                        reservedAppAttributes,
                        ReservedAppAttributeName.APP_JOB_NAME,
                      )}
                      children={<RoundedInput />}
                      currentPartitionIsWithGpu={currentPartitionIsWithGpu}
                      appId={appId}
                      clusterId={selectedCluster}
                    />
                  </Form>
                </BorderlessCard>
              </PaddedCard>
            </div>

            <ResourceConfigSection
              form={resourceForm}
              accountOptions={accountOptions}
              selectedAccount={selectedAccount}
              clusterName={clusterName}
              clusterDisabled={!hasAvailableAccount}
              partitionRows={partitionRows}
              activePartitionTab={activePartitionTab}
              onActivePartitionTabChange={setActivePartitionTab}
              selectedPartitionKey={selectedPartition}
              onPartitionSelect={(value) => {
                resourceForm.setFieldValue("partition", value);
              }}
              qosOptions={qosOptions}
              inputsDisabled={inputsDisabled}
              maxTimeUnit={maxTimeUnitValue}
              onMaxTimeUnitChange={setMaxTimeUnitValue}
              selectedPresetUnit={selectedPresetUnit}
              onSelectedPresetUnitChange={setSelectedPresetUnit}
              languageId={languageId}
              appId={appId}
              clusterId={selectedCluster}
              reservedAppAttributes={reservedAppAttributes}
              currentPartitionInfo={currentPartitionInfoForForm}
              maxRunningTimeHours={maxRunningTimeHours}
            />

            <AppConfigSection
              form={appForm}
              languageId={languageId}
              appId={appId}
              clusterId={selectedCluster}
              attributes={attributes}
              currentPartitionInfo={currentPartitionInfoForForm}
            />
          </JobContainer>
        </JobMainContent>

        <JobSidePanel>
          <JobSidePanelInner>
            <SidePanelGroupWrapper>
              {appCommentI18nText && (
                <>
                  <JobSidePanelScrollBox>
                    <AppCommentContainer>
                      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {appCommentI18nText}
                      </Markdown>
                    </AppCommentContainer>
                  </JobSidePanelScrollBox>
                  <SidePanelDivider />
                </>
              )}
              <JobSideInfo
                labels={{
                  totalNodeCount: t(p("totalNodeCount")),
                  totalGpuCount: t(p("totalGpuCount")),
                  totalCoreCount: t(p("totalCoreCount")),
                  totalMemory: t(p("totalMemory")),
                  costPerHour: t(p("costPerHour")),
                  pricingStandard: t(p("pricingStandard")),
                  yuan: t(p("yuan")),
                  hours: t(p("hours")),
                  accountNameLabel: t(p("accountNameLabel")),
                  whitelistTag: t(p("whitelistTag")),
                  accountOwner: t(p("accountOwner")),
                  accountBalance: t(p("accountBalance")),
                  accountBlockThreshold: t(p("accountBlockThreshold")),
                  userUsedLimit: t(p("userUsedLimit")),
                  userChargeNoLimit: t(p("userChargeNoLimit")),
                }}
                nodeCount={nodeCount}
                totalGpuCount={totalGpuCount}
                totalCpuCount={totalCpuCount}
                totalMemory={totalMemory}
                hourlyPrice={formattedHourlyPrice}
                showHourlyPriceUnit={jobOneHourPrice != null}
                pricingStandardUrl={join(publicConfig.MIS_URL, "/user/partitions")}
                accountInfo={accountInfoQuery.data}
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
            onClick={handleOpenSaveTemplateModal}
          >
            {t(p("saveToTemplate"))}
          </FooterStatValue>
        </div>
        <FooterActions>
          <Button onClick={handleGoBack} style={{ marginRight: "10px" }}>
            {t("button.cancelButton")}
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={isSubmitting}>
            {t("button.submitButton")}
          </Button>
        </FooterActions>
      </FixedFooter>

      <SaveAsTemplateModal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} onSave={handleSaveAsTemplate} />
      <AppTemplateListModal
        open={templateListOpen}
        onClose={() => setTemplateListOpen(false)}
        onUse={handleUseTemplate}
        appId={appId}
        cluster={selectedCluster}
        attributes={attributes}
        refreshSignal={templateRefreshSignal}
      />
      <StyledModal
        open={expiredTemplate !== undefined}
        title={t(p("unavailableParamsTitle"))}
        onOk={handleDeleteExpiredTemplate}
        onCancel={() => setExpiredTemplate(undefined)}
        okText={t(p("unavailableParamsConfirm"))}
        cancelText={t(p("unavailableParamsCancel"))}
        confirmLoading={deletingExpiredTemplate}
        centered
      >
        {t(p("unavailableParamsDesc"))}
      </StyledModal>
    </>
  );
};
