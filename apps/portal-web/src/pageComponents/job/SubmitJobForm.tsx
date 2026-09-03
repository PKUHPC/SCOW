import { parsePlaceholder } from "@scow/lib-config/build/parse";
import { FixedFooter, FooterActions, FooterStatValue } from "@scow/lib-web/build/components/job/Footer";
import { JobSideInfo } from "@scow/lib-web/build/components/job/JobSideInfo";
import { AntdButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import {
  BorderlessCard,
  HeaderRow,
  HeaderTitle,
  PaddedCard,
} from "@scow/lib-web/build/components/styledAntdCom/DualTitleCard";
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import {
  JobContainer,
  JobMainContent,
  JobPageLayout,
  JobSidePanel,
  JobSidePanelInner,
} from "@scow/lib-web/build/layouts/base/JobContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Spin } from "antd";
import dayjs from "dayjs";
import Router from "next/router";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AccountUnavailableReason, TimeUnit } from "src/models/job";
import { Partition } from "src/pages/api/cluster";
import { JobTemplateDetail } from "src/pages/api/job/listJobTemplates";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { formatSize } from "src/utils/format";
import { styled, useTheme } from "styled-components";

import { BaseInfoSection } from "./submitJobCom/BaseInfoSection";
import { JobConfigSection } from "./submitJobCom/JobConfigSection";
import {
  MAX_TIME_PRESETS,
  PartitionRow,
  PartitionTabKey,
  ResourceConfigSection,
} from "./submitJobCom/ResourceConfigSection";
import { SaveAsTemplateModal } from "./submitJobCom/SaveAsTemplateModal";
import { BaseFormValues, JobFormValues, ResourceFormValues } from "./submitJobCom/SubmitJobForm.types";
import { TemplateListModal } from "./submitJobCom/TemplateListModal";

interface JobForm extends JobFormValues, ResourceFormValues {
  maxTimeUnit: TimeUnit;
  activePartitionTab: PartitionTabKey;
}

// 生成默认工作名称，命名规则为年月日-时分秒，如job-20230510-103010
const genJobName = (): string => {
  return `job-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const initialValues = {
  command: "",
  nodeCount: 1,
  cpuCores: 1,
  gpuCores: 1,
  maxTime: 30,
  maxTimeUnit: TimeUnit.HOURS,
  activePartitionTab: "cpu" as PartitionTabKey,
  output: "job.%j.out",
  scriptOutput: "job.%j.sh",
  errorOutput: "job.%j.err",
} as Partial<JobForm>;

interface Props {
  submitJobPromptText: string;
}

const p = prefix("pageComp.job.submitJobForm.");
const pCommon = prefix("common.");
const pResource = prefix("pageComp.submitJobCom.ResourceConfigSection.");

const JobPageLoading = styled.div`
  width: 100%;
  min-height: calc(100vh - 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.token.colorBgContainer};
`;

export const SubmitJobForm: React.FC<Props> = ({ submitJobPromptText }) => {
  const { currentClusters, setDefaultCluster, defaultCluster, fullClusterConfigs } = useStore(ClusterInfoStore);

  if (!defaultCluster && currentClusters.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const { message, modal } = App.useApp();
  const theme = useTheme();

  const [baseForm] = Form.useForm<BaseFormValues>();
  const [resourceForm] = Form.useForm<ResourceFormValues>();
  const [jobForm] = Form.useForm<JobFormValues>();
  const defaultJobName = useMemo(() => genJobName(), []);
  const [selectorResetKey, setSelectorResetKey] = useState(0);
  const [activePartitionTab, setActivePartitionTab] = useState<PartitionTabKey>(
    initialValues.activePartitionTab ?? "cpu",
  );

  // 获取账户集群映射及不可用原因
  const { data: accountClustersWithReasons, isLoading: isGetAccountClustersWithUnavailableReasons } = useAsync({
    promiseFn: useCallback(async () => api.getAccountClustersWithUnavailableReasons({ query: {} }), []),
  });

  // 生成默认作业名称，帮助用户快速提交
  const [jobName, setJobName] = useState(defaultJobName);
  const [output, setOutput] = useState(initialValues.output ?? "job.%j.out");
  const [errorOutput, setErrorOutput] = useState(initialValues.errorOutput ?? "job.%j.err");
  const [scriptOutput, setScriptOutput] = useState(initialValues.scriptOutput ?? "job.%j.sh");

  const handleJobNameChange = (value: string) => {
    setJobName(value);
    baseForm.setFieldValue("jobName", value);
  };

  const handleOutputChange = (value: string) => {
    setOutput(value);
    jobForm.setFieldValue("output", value);
  };

  const handleErrorOutputChange = (value: string) => {
    setErrorOutput(value);
    jobForm.setFieldValue("errorOutput", value);
  };

  const handleScriptOutputChange = (value: string) => {
    setScriptOutput(value);
    jobForm.setFieldValue("scriptOutput", value);
  };

  const calculateScriptOutput = () => {
    const parseName = parsePlaceholder("{{ name }}", { name: jobName }).trim();
    return parseName ? `${parseName}.sh` : "";
  };

  const t = useI18nTranslateToString();
  const { user } = useStore(UserStore);
  const languageId = useI18n().currentLanguage.id;

  const accountReasonTextMap = useMemo<Record<number, string>>(
    () => ({
      [AccountUnavailableReason.USER_BLOCKED]: t(pResource("accountUserBlocked")),
      [AccountUnavailableReason.ACCOUNT_FROZEN]: t(pResource("accountFrozen")),
      [AccountUnavailableReason.ACCOUNT_BLOCKED]: t(pResource("accountBlocked")),
      [AccountUnavailableReason.ACCOUNT_DEBT]: t(pResource("accountDebt")),
      [AccountUnavailableReason.USER_QUOTA_EXCEEDED]: t(pResource("userQuotaExceeded")),
    }),
    [t],
  );

  const accountDetails = useMemo(
    () => accountClustersWithReasons?.accountClusters ?? [],
    [accountClustersWithReasons?.accountClusters],
  );

  const accountClusterMap = useMemo(() => {
    return Object.fromEntries(accountDetails.map((item) => [item.accountName, item.clusters])) as Record<
      string,
      string[]
    >;
  }, [accountDetails]);
  const accountOptions = useMemo(() => {
    return [...accountDetails]
      .sort((a, b) => {
        if (a.available !== b.available) {
          return a.available ? -1 : 1;
        }
        return a.accountName.localeCompare(b.accountName);
      })
      .map((account) => ({
        label: account.accountName,
        value: account.accountName,
        disabled: !account.available,
        disabledReason: account.unavailableReasons.map((reason) => accountReasonTextMap[reason] ?? reason).join("；"),
      }));
  }, [accountDetails, accountReasonTextMap]);
  const availableAccountOptions = useMemo(() => accountOptions.filter((option) => !option.disabled), [accountOptions]);

  const selectedAccount = Form.useWatch<string | undefined>("account", resourceForm);
  const selectedCluster = Form.useWatch<string | undefined>("cluster", resourceForm);
  const selectedPartition = Form.useWatch<string | undefined>("partition", resourceForm);
  const selectedQos = Form.useWatch<string | undefined>("qos", resourceForm);
  const selectedNodeCount = Form.useWatch<number | undefined>("nodeCount", resourceForm);
  const selectedCpuCores = Form.useWatch<number | undefined>("cpuCores", resourceForm);
  const selectedGpuCores = Form.useWatch<number | undefined>("gpuCores", resourceForm);
  const selectedMaxTime = Form.useWatch<number | undefined>("maxTime", resourceForm);
  const [maxTimeUnit, setMaxTimeUnit] = useState<TimeUnit>(initialValues.maxTimeUnit ?? TimeUnit.HOURS);
  const [selectedPresetUnit, setSelectedPresetUnit] = useState<TimeUnit | undefined>(TimeUnit.MINUTES);

  const clusterOptions = useMemo(() => {
    const allowedClusters = new Set<string>(selectedAccount ? (accountClusterMap[selectedAccount] ?? []) : []);
    const allAuthorizedClusters = new Set(accountDetails.flatMap((account) => account.clusters));
    return currentClusters
      .filter((cluster) => allAuthorizedClusters.has(cluster.id))
      .map((cluster) => ({
        id: cluster.id,
        name: getI18nConfigCurrentText(cluster.name, languageId),
        disabled: !selectedAccount || !allowedClusters.has(cluster.id),
      }));
  }, [accountClusterMap, accountDetails, currentClusters, languageId, selectedAccount]);

  const selectedClusterInfo = useMemo(
    () => currentClusters.find((cluster) => cluster.id === selectedCluster),
    [currentClusters, selectedCluster],
  );
  const maxRunningTimeHours = selectedCluster
    ? fullClusterConfigs[selectedCluster]?.hpc?.job?.maxRunningTimeHours
    : undefined;

  const homeDirectoryQuery = useAsync({
    promiseFn: useCallback(
      async () => (selectedCluster ? api.getHomeDirectory({ query: { cluster: selectedCluster } }) : { path: "" }),
      [selectedCluster],
    ),
  });

  // 保留之前的逻辑：提交作业时选择集群，将该集群设置默认集群
  useEffect(() => {
    if (!selectedClusterInfo) {
      return;
    }
    setDefaultCluster({
      id: selectedClusterInfo.id,
      name: selectedClusterInfo.name,
    });
  }, [selectedClusterInfo, setDefaultCluster]);

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

    return partitions.map((partition) => {
      const summary = summaryPartitions.find((item) => item.partitionName === partition.name);
      const nodeTotal = summary?.nodeCount;
      const perNodeDivisor = nodeTotal && nodeTotal > 0 ? nodeTotal : 1;
      const nodeSpecParts = [
        partition.gpus ? t(pResource("nodeSpecGpu"), [partition.gpus / perNodeDivisor]) : undefined,
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
      const kind: PartitionTabKey = partition.gpus && partition.gpus > 0 ? "gpu" : "cpu";
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
  }, [
    availablePartitionsForAccountQuery.isLoading,
    availablePartitionsForAccountQuery.data?.accountName,
    availablePartitionsForAccountQuery.data?.cluster,
    availablePartitionsForAccountQuery.data?.partitions,
    clusterRunningInfoQuery.data?.clusterInfo.partitions,
    languageId,
    selectedAccount,
    selectedCluster,
  ]);

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

  const nodeCountLimit = selectedPartitionInfo?.nodes;
  const unitCountLimit = useMemo(() => {
    if (!selectedPartitionInfo?.nodes) {
      return undefined;
    }
    if (activePartitionTab === "gpu") {
      if (!selectedPartitionInfo.gpus) {
        return undefined;
      }
      return selectedPartitionInfo.gpus / selectedPartitionInfo.nodes;
    }
    if (!selectedPartitionInfo.cores) {
      return undefined;
    }
    return selectedPartitionInfo.cores / selectedPartitionInfo.nodes;
  }, [activePartitionTab, selectedPartitionInfo]);

  const inputsDisabled = !selectedPartitionInfo;

  const totalGpuCount = useMemo(() => {
    if (!selectedPartitionInfo) {
      return "-";
    }
    if (activePartitionTab !== "gpu") {
      return 0;
    }
    const gpuPerNode = selectedGpuCores ?? 0;
    const nodes = selectedNodeCount ?? 0;
    return gpuPerNode * nodes;
  }, [activePartitionTab, selectedGpuCores, selectedNodeCount, selectedPartitionInfo]);

  const totalCpuCount = useMemo(() => {
    const nodes = selectedNodeCount ?? 0;
    if (!nodes || !selectedPartitionInfo) {
      return "-";
    }
    if (activePartitionTab === "gpu") {
      const gpuPerNode = selectedGpuCores ?? 0;
      const coresPerGpu = selectedPartitionInfo.gpus
        ? Math.floor(selectedPartitionInfo.cores / selectedPartitionInfo.gpus)
        : 0;
      return gpuPerNode && coresPerGpu ? `${nodes * gpuPerNode * coresPerGpu}` : "-";
    }
    const cpuPerNode = selectedCpuCores ?? 0;
    return cpuPerNode ? `${nodes * cpuPerNode}` : "-";
  }, [activePartitionTab, selectedCpuCores, selectedGpuCores, selectedNodeCount, selectedPartitionInfo]);

  const totalMemory = useMemo(() => {
    if (!selectedPartitionInfo || !selectedNodeCount) {
      return "-";
    }
    const memPerCore = Math.floor(selectedPartitionInfo.memMb / selectedPartitionInfo.cores);
    if (activePartitionTab === "gpu") {
      const gpuPerNode = selectedGpuCores ?? 0;
      const coresPerGpu = selectedPartitionInfo.gpus
        ? Math.floor(selectedPartitionInfo.cores / selectedPartitionInfo.gpus)
        : 0;
      const memorySize = selectedNodeCount * gpuPerNode * coresPerGpu * memPerCore;
      return memorySize > 0 ? formatSize(memorySize, ["MB", "GB", "TB"]) : "-";
    }
    const cpuPerNode = selectedCpuCores ?? 0;
    const memorySize = selectedNodeCount * cpuPerNode * memPerCore;
    return memorySize > 0 ? formatSize(memorySize, ["MB", "GB", "TB"]) : "-";
  }, [activePartitionTab, selectedCpuCores, selectedGpuCores, selectedNodeCount, selectedPartitionInfo]);

  const timeSecondsForPrice = 3600;

  const { data: jobOneHourPrice } = useAsync({
    promiseFn: useCallback(async () => {
      if (!selectedAccount || !selectedCluster || !selectedPartition || !selectedQos || !selectedPartitionInfo) {
        return undefined;
      }
      const nodes = selectedNodeCount ?? 0;
      if (!nodes) {
        return undefined;
      }

      if (activePartitionTab === "gpu") {
        const gpuPerNode = selectedGpuCores ?? 0;
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

      const cpuPerNode = selectedCpuCores ?? 0;
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
      selectedCpuCores,
      selectedGpuCores,
      selectedNodeCount,
      selectedPartition,
      selectedPartitionInfo,
      selectedQos,
      timeSecondsForPrice,
    ]),
  });

  const formattedHourlyPrice = jobOneHourPrice == null ? "-" : jobOneHourPrice.toFixed(2);

  const [submitting, setSubmitting] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [pendingTemplatePartition, setPendingTemplatePartition] = useState<string | undefined>();
  const [pendingTemplateQos, setPendingTemplateQos] = useState<string | undefined>();
  const [expiredTemplate, setExpiredTemplate] = useState<{ id: number; templateName: string } | undefined>();
  const [deletingExpiredTemplate, setDeletingExpiredTemplate] = useState(false);
  const [templateRefreshSignal, setTemplateRefreshSignal] = useState(0);

  useEffect(() => {
    setJobName(defaultJobName);
    baseForm.setFieldValue("jobName", defaultJobName);
  }, [baseForm, defaultJobName]);

  const calcMemoryMb = (resourceValues: ResourceFormValues) => {
    if (!selectedPartitionInfo) {
      return undefined;
    }
    const memPerCore = Math.floor(selectedPartitionInfo.memMb / selectedPartitionInfo.cores);
    const nodes = resourceValues.nodeCount ?? 0;
    if (!nodes || !memPerCore) {
      return undefined;
    }
    if (activePartitionTab === "gpu") {
      const gpuPerNode = resourceValues.gpuCores ?? 0;
      const coresPerGpu = selectedPartitionInfo.gpus
        ? Math.floor(selectedPartitionInfo.cores / selectedPartitionInfo.gpus)
        : 0;
      const size = nodes * gpuPerNode * coresPerGpu * memPerCore;
      return size > 0 ? size : undefined;
    }
    const cpuPerNode = resourceValues.cpuCores ?? 0;
    const size = nodes * cpuPerNode * memPerCore;
    return size > 0 ? size : undefined;
  };

  const calcSubmitCounts = (resourceValues: ResourceFormValues) => {
    const submitCoreCount =
      activePartitionTab === "gpu"
        ? (resourceValues.gpuCores ?? 0) *
          Math.floor((selectedPartitionInfo?.cores ?? 0) / (selectedPartitionInfo?.gpus ?? 1))
        : (resourceValues.cpuCores ?? 0);

    const submitGpuCount = activePartitionTab === "gpu" ? (resourceValues.gpuCores ?? 0) : undefined;

    return { submitCoreCount, submitGpuCount };
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const baseValues = await baseForm.validateFields();
      const resourceValues = await resourceForm.validateFields();
      const jobValues = await jobForm.validateFields();

      const memoryMb = calcMemoryMb(resourceValues);
      const { submitCoreCount, submitGpuCount } = calcSubmitCounts(resourceValues);

      await api
        .submitJob({
          body: {
            cluster: resourceValues.cluster,
            partition: resourceValues.partition,
            nodeCount: resourceValues.nodeCount,
            coreCount: submitCoreCount,
            gpuCount: submitGpuCount,
            command: jobValues.command,
            jobName: baseValues.jobName,
            qos: resourceValues.qos,
            maxTime: resourceValues.maxTime,
            maxTimeUnit: selectedPresetUnit ?? maxTimeUnit,
            account: resourceValues.account,
            workingDirectory: jobValues.workingDirectory,
            output: jobValues.output,
            errorOutput: jobValues.errorOutput,
            memory: memoryMb ? `${memoryMb}MB` : undefined,
            comment: "",
            save: false,
            scriptOutput: jobValues.scriptOutput,
          },
        })
        .httpError(500, (e) => {
          if (e.code === "SCHEDULER_FAILED") {
            modal.error({ title: t(p("errorMessage")), content: e.message });
          } else {
            throw e;
          }
        })
        .httpError(404, (e) => {
          if (e.code === "NOT_FOUND") {
            modal.error({ title: t(p("errorMessage")), content: e.message });
          } else {
            throw e;
          }
        })
        .httpError(400, (e) => {
          if (e.code === "INVALID_ARGUMENT") {
            modal.error({ title: t(p("errorMessage")), content: e.message });
          } else {
            throw e;
          }
        })
        .httpError(403, (e) => {
          if (e.code === "USER_ACCOUNT_NOT_AVAILABLE") {
            modal.error({
              title: t(p("errorMessage")),
              content: t("pages.common.userAccountNotAvailableWhenSubmit", [user?.identityId, resourceValues.account]),
            });
          } else if (e.code === "CLUSTER_PARTITION_NOT_AVAILABLE") {
            const clusterName = getI18nConfigCurrentText(
              currentClusters.find((x) => x.id === resourceValues.cluster)?.name ?? resourceValues.cluster,
              languageId,
            );
            modal.error({
              title: t(p("errorMessage")),
              content: t("pages.common.clusterPartitionNotAvailableForAccount", [
                resourceValues.account,
                clusterName,
                resourceValues.partition,
              ]),
            });
          } else {
            throw e;
          }
        })
        .httpError(429, () => {
          message.error(t(pCommon("noSpaceError")));
        })
        .then(({ jobId }) => {
          message.success(t(p("successMessage")) + jobId);
          Router.push("/jobs/allJobs");
        });
    } finally {
      setSubmitting(false);
    }
  };

  const [savingTemplate, setSavingTemplate] = useState(false);
  const handleSaveAsTemplate = async (templateName: string) => {
    if (savingTemplate || submitting) {
      return;
    }
    const resourceValues = await resourceForm.validateFields();
    const jobValues = await jobForm.validateFields();

    try {
      setSavingTemplate(true);
      const memoryMb = calcMemoryMb(resourceValues);
      const { submitCoreCount, submitGpuCount } = calcSubmitCounts(resourceValues);

      await api
        .saveAsJobTemplate({
          body: {
            cluster: resourceValues.cluster,
            templateName,
            account: resourceValues.account,
            partition: resourceValues.partition,
            qos: resourceValues.qos,
            nodeCount: resourceValues.nodeCount,
            coreCount: submitCoreCount,
            gpuCount: submitGpuCount ?? 0,
            memoryMb: memoryMb ?? undefined,
            command: jobValues.command,
            maxTime: resourceValues.maxTime,
            maxTimeUnit: selectedPresetUnit ?? maxTimeUnit,
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
    if (savingTemplate || submitting) {
      return;
    }
    try {
      await baseForm.validateFields();
      await resourceForm.validateFields();
      await jobForm.validateFields();
      setSaveModalOpen(true);
    } catch {
      message.warning(t(p("completeRequiredInfo")));
    }
  };

  const handleUseTemplate = async ({ cluster, template }: { cluster: string; template: JobTemplateDetail }) => {
    const accountAvailable =
      template.account && availableAccountOptions.some((option) => option.value === template.account);
    if (!accountAvailable) {
      showTemplateExpiredConfirm(template);
      return;
    }

    if (!(accountClusterMap[template.account] ?? []).includes(cluster)) {
      showTemplateExpiredConfirm(template);
      return;
    }

    let matchedPartition: Partition | undefined;
    if (template.partition) {
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
      const useGpu = (matchedPartition.gpus ?? 0) > 0;
      if (useGpu && template.gpuCount && template.gpuCount > matchedPartition.gpus) {
        showTemplateExpiredConfirm(template);
        return;
      }
      if (!useGpu && template.coreCount > matchedPartition.cores) {
        showTemplateExpiredConfirm(template);
        return;
      }
    }

    const useGpuTab = matchedPartition
      ? (matchedPartition.gpus ?? 0) > 0
      : !!template.gpuCount && template.gpuCount > 0;

    const nextResourceValues: Partial<ResourceFormValues> = {
      account: template.account,
      cluster,
      partition: template.partition,
      qos: template.qos,
      nodeCount: template.nodeCount,
      maxTime: template.maxTime,
    };
    if (useGpuTab) {
      nextResourceValues.gpuCores = template.gpuCount;
      nextResourceValues.cpuCores = undefined;
    } else {
      nextResourceValues.cpuCores = template.coreCount;
      nextResourceValues.gpuCores = undefined;
    }

    setActivePartitionTab(useGpuTab ? "gpu" : "cpu");
    setPendingTemplatePartition(template.partition);
    setPendingTemplateQos(template.qos);
    resourceForm.setFieldsValue(nextResourceValues);
    const templateMaxTimeUnit = template.maxTimeUnit ?? TimeUnit.HOURS;
    const matchedMaxTimePreset = MAX_TIME_PRESETS.find(
      (preset) => preset.maxTime === template.maxTime && preset.maxTimeUnit === templateMaxTimeUnit,
    );
    setMaxTimeUnit(templateMaxTimeUnit);
    setSelectedPresetUnit(matchedMaxTimePreset?.maxTimeUnit);
    setSelectorResetKey((prev) => prev + 1);
    jobForm.setFieldValue("command", template.command ?? "");
    setTemplateListOpen(false);
  };

  const showTemplateExpiredConfirm = (template: JobTemplateDetail) => {
    setExpiredTemplate({ id: template.id, templateName: template.templateName });
  };

  const handleDeleteExpiredTemplate = async () => {
    if (!expiredTemplate) return;
    setDeletingExpiredTemplate(true);
    await api
      .deleteJobTemplate({ query: expiredTemplate })
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

  useEffect(() => {
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
  }, [pendingTemplateQos, qosOptions, resourceForm, selectedQos]);

  useEffect(() => {
    if (!selectedPartitionInfo) {
      return;
    }
    const nodeCountNotSet = selectedNodeCount === undefined || selectedNodeCount === null;
    if (nodeCountNotSet && !resourceForm.isFieldTouched("nodeCount")) {
      const storeNodeCount = resourceForm.getFieldValue("nodeCount");
      if (storeNodeCount === undefined || storeNodeCount === null) {
        resourceForm.setFieldValue("nodeCount", initialValues.nodeCount ?? 1);
      }
    }
    if (activePartitionTab === "gpu") {
      const gpuCoresNotSet = selectedGpuCores === undefined || selectedGpuCores === null;
      if (gpuCoresNotSet && !resourceForm.isFieldTouched("gpuCores")) {
        const storeGpuCores = resourceForm.getFieldValue("gpuCores");
        if (storeGpuCores === undefined || storeGpuCores === null) {
          resourceForm.setFieldValue("gpuCores", initialValues.gpuCores ?? 1);
        }
      }
    } else {
      const cpuCoresNotSet = selectedCpuCores === undefined || selectedCpuCores === null;
      if (cpuCoresNotSet && !resourceForm.isFieldTouched("cpuCores")) {
        const storeCpuCores = resourceForm.getFieldValue("cpuCores");
        if (storeCpuCores === undefined || storeCpuCores === null) {
          resourceForm.setFieldValue("cpuCores", initialValues.cpuCores ?? 1);
        }
      }
    }
  }, [activePartitionTab, resourceForm, selectedCpuCores, selectedGpuCores, selectedNodeCount, selectedPartitionInfo]);

  useEffect(() => {
    const maxTimeNotSet = selectedMaxTime === undefined || selectedMaxTime === null;
    if (maxTimeNotSet && !resourceForm.isFieldTouched("maxTime")) {
      resourceForm.setFieldValue("maxTime", initialValues.maxTime ?? 30);
    }
  }, [resourceForm, selectedMaxTime]);

  useEffect(() => {
    if (!jobForm.isFieldTouched("output")) {
      jobForm.setFieldValue("output", output);
    }
    if (!jobForm.isFieldTouched("errorOutput")) {
      jobForm.setFieldValue("errorOutput", errorOutput);
    }
  }, [errorOutput, jobForm, output]);

  useEffect(() => {
    if (!jobForm.isFieldTouched("scriptOutput")) {
      const nextScriptOutput = calculateScriptOutput();
      setScriptOutput(nextScriptOutput);
      jobForm.setFieldValue("scriptOutput", nextScriptOutput);
    }
  }, [jobForm, jobName]);

  useEffect(() => {
    if (!pendingTemplatePartition) {
      return;
    }
    if (partitionRows.some((row) => row.key === pendingTemplatePartition)) {
      resourceForm.setFieldValue("partition", pendingTemplatePartition);
      setPendingTemplatePartition(undefined);
    }
  }, [partitionRows, pendingTemplatePartition, resourceForm]);

  useEffect(() => {
    if (!availableAccountOptions.length) {
      return;
    }
    const currentAccount = resourceForm.getFieldValue("account");
    if (!currentAccount || !availableAccountOptions.some((option) => option.value === currentAccount)) {
      resourceForm.setFieldValue("account", availableAccountOptions[0].value);
    }
  }, [availableAccountOptions, resourceForm]);

  useEffect(() => {
    if (!selectedAccount) {
      resourceForm.setFieldValue("cluster", undefined);
      return;
    }
    const currentCluster = resourceForm.getFieldValue("cluster");
    const clusterValid =
      currentCluster && clusterOptions.some((option) => option.id === currentCluster && !option.disabled);
    const preferredCluster = defaultCluster?.id;
    const preferredClusterValid =
      preferredCluster && clusterOptions.some((option) => option.id === preferredCluster && !option.disabled);
    if (!clusterValid) {
      const firstEnabledCluster = clusterOptions.find((option) => !option.disabled)?.id;
      resourceForm.setFieldValue("cluster", preferredClusterValid ? preferredCluster : firstEnabledCluster);
    }
  }, [clusterOptions, defaultCluster?.id, resourceForm, selectedAccount]);

  // 单位或配置上限变化时触发校验，让用户看到最新提示
  useEffect(() => {
    const currentValue = resourceForm.getFieldValue("maxTime");
    if (currentValue !== undefined && currentValue !== null) {
      resourceForm.validateFields(["maxTime"]);
    }
  }, [maxTimeUnit, maxRunningTimeHours, resourceForm, selectedPresetUnit]);

  return (
    <>
      <JobPageLayout>
        {isGetAccountClustersWithUnavailableReasons ? (
          <JobPageLoading>
            <Spin />
          </JobPageLoading>
        ) : (
          <>
            <JobMainContent>
              <JobContainer direction="vertical" size={0}>
                <PaddedCard
                  styles={{ header: { borderBottom: "none" } }}
                  title={
                    <HeaderRow
                      align="center"
                      style={{
                        justifyContent: "space-between",
                        borderBottom: `1px solid ${theme.palette.gray[4]}`,
                        paddingBottom: 24,
                      }}
                    >
                      <HeaderTitle>{t(p("title"))}</HeaderTitle>
                      <Button
                        type="link"
                        style={{ padding: 0, fontSize: 16 }}
                        onClick={() => setTemplateListOpen(true)}
                      >
                        {t(p("templateButton"))}
                      </Button>
                    </HeaderRow>
                  }
                >
                  <BorderlessCard $showDivider title={<SectionTitle>{t(p("basicInfoSectionTitle"))}</SectionTitle>}>
                    <BaseInfoSection form={baseForm} jobName={jobName} onJobNameChange={handleJobNameChange} />
                  </BorderlessCard>
                </PaddedCard>

                <ResourceConfigSection
                  form={resourceForm}
                  accountOptions={accountOptions}
                  accountLoading={isGetAccountClustersWithUnavailableReasons}
                  clusterOptions={clusterOptions}
                  selectedAccount={selectedAccount}
                  selectedCluster={selectedCluster}
                  partitionRows={partitionRows}
                  activePartitionTab={activePartitionTab}
                  onActivePartitionTabChange={setActivePartitionTab}
                  selectedPartitionKey={selectedPartition}
                  onPartitionSelect={(value) => resourceForm.setFieldValue("partition", value)}
                  qosOptions={qosOptions}
                  nodeCountLimit={nodeCountLimit}
                  unitCountLimit={unitCountLimit}
                  inputsDisabled={inputsDisabled}
                  maxTimeUnit={maxTimeUnit}
                  onMaxTimeUnitChange={setMaxTimeUnit}
                  selectedPresetUnit={selectedPresetUnit}
                  onSelectedPresetUnitChange={setSelectedPresetUnit}
                  selectorResetKey={selectorResetKey}
                  maxRunningTimeHours={maxRunningTimeHours}
                />

                <JobConfigSection
                  form={jobForm}
                  cluster={selectedClusterInfo}
                  submitJobPromptText={submitJobPromptText}
                  jobName={jobName}
                  output={output}
                  errorOutput={errorOutput}
                  onOutputChange={handleOutputChange}
                  onErrorOutputChange={handleErrorOutputChange}
                  scriptOutput={scriptOutput}
                  onScriptOutputChange={handleScriptOutputChange}
                  homePath={homeDirectoryQuery.data?.path}
                />
              </JobContainer>
            </JobMainContent>

            <JobSidePanel>
              <JobSidePanelInner>
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
                  nodeCount={selectedNodeCount}
                  totalGpuCount={totalGpuCount}
                  totalCpuCount={totalCpuCount}
                  totalMemory={totalMemory}
                  hourlyPrice={formattedHourlyPrice}
                  showHourlyPriceUnit={jobOneHourPrice != null}
                  pricingStandardUrl={join(publicConfig.MIS_URL, "/user/partitions")}
                  accountInfo={accountInfoQuery.data}
                />
              </JobSidePanelInner>
            </JobSidePanel>
          </>
        )}
      </JobPageLayout>

      {!isGetAccountClustersWithUnavailableReasons && (
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
            <AntdButton type="primary" onClick={handleSubmit} loading={submitting}>
              {t(p("submitButton"))}
            </AntdButton>
          </FooterActions>
        </FixedFooter>
      )}

      <SaveAsTemplateModal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} onSave={handleSaveAsTemplate} />
      <TemplateListModal
        open={templateListOpen}
        onUse={handleUseTemplate}
        onClose={() => setTemplateListOpen(false)}
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
