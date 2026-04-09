import { parsePlaceholder } from "@scow/lib-config/build/parse";
import { FixedFooter, FooterActions, FooterStats, FooterStatValue } from "@scow/lib-web/build/components/job/Footer";
import { AntdButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import {
  BorderlessCard,
  HeaderRow,
  HeaderTitle,
  PaddedCard,
} from "@scow/lib-web/build/components/styledAntdCom/DualTitleCard";
import { StyledModal } from "@scow/lib-web/build/components/styledAntdCom/Modal";
import { TableWithSplitLines } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { PageContainer } from "@scow/lib-web/build/layouts/base/PageContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Typography } from "antd";
import dayjs from "dayjs";
import Router from "next/router";
import { join } from "path";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TimeUnit } from "src/models/job";
import { Partition } from "src/pages/api/cluster";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { useTheme } from "styled-components";
import { formatSize } from "src/utils/format";

import { BaseInfoSection } from "./submitJobCom/BaseInfoSection";
import { JobConfigSection } from "./submitJobCom/JobConfigSection";
import { PartitionRow, PartitionTabKey, ResourceConfigSection } from "./submitJobCom/ResourceConfigSection";
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
  maxTimeUnit: TimeUnit.MINUTES,
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

interface UnavailableParamRow {
  key: string;
  label: string;
  templateValue: string;
  recommendedValue: string;
}

export const SubmitJobForm: React.FC<Props> = ({ submitJobPromptText }) => {
  const { message, modal } = App.useApp();
  const theme = useTheme();
  const gray = theme.palette.gray;

  const [baseForm] = Form.useForm<BaseFormValues>();
  const [resourceForm] = Form.useForm<ResourceFormValues>();
  const [jobForm] = Form.useForm<JobFormValues>();
  const defaultJobName = useMemo(() => genJobName(), []);
  const [activePartitionTab, setActivePartitionTab] = useState<PartitionTabKey>(
    initialValues.activePartitionTab ?? "cpu",
  );

  // 获取可用账户和可以集群
  const { data: availableAccountsAndClusters, isLoading: isGetAvailableAccountsAndClusters } = useAsync({
    promiseFn: useCallback(async () => api.getAvailableAccountsAndClusters({ query: {} }), []),
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
  const { currentClusters, setDefaultCluster, defaultCluster } = useStore(ClusterInfoStore);
  const languageId = useI18n().currentLanguage.id;
  const isFullDisplayMode = useMemo(() => {
    return user?.isAdmin || publicConfig.DASHBOARD_USER_DISPLAY_MODE === "full";
  }, [user]);

  const accountClusterMap = useMemo(() => {
    const accountClusters = availableAccountsAndClusters?.accountClusters ?? [];
    return Object.fromEntries(accountClusters.map((item) => [item.accountName, item.clusters])) as Record<
      string,
      string[]
    >;
  }, [availableAccountsAndClusters?.accountClusters]);
  const accountOptions = useMemo(
    () =>
      Object.keys(accountClusterMap).map((account) => ({
        label: account,
        value: account,
      })),
    [accountClusterMap],
  );

  const selectedAccount = Form.useWatch<string | undefined>("account", resourceForm);
  const selectedCluster = Form.useWatch<string | undefined>("cluster", resourceForm);
  const selectedPartition = Form.useWatch<string | undefined>("partition", resourceForm);
  const selectedQos = Form.useWatch<string | undefined>("qos", resourceForm);
  const selectedNodeCount = Form.useWatch<number | undefined>("nodeCount", resourceForm);
  const selectedCpuCores = Form.useWatch<number | undefined>("cpuCores", resourceForm);
  const selectedGpuCores = Form.useWatch<number | undefined>("gpuCores", resourceForm);
  const selectedMaxTime = Form.useWatch<number | undefined>("maxTime", resourceForm);
  const [maxTimeUnit, setMaxTimeUnit] = useState<TimeUnit>(initialValues.maxTimeUnit ?? TimeUnit.MINUTES);

  const clusterOptions = useMemo(() => {
    const allowedClusters = new Set<string>(selectedAccount ? (accountClusterMap[selectedAccount] ?? []) : []);
    return currentClusters.map((cluster) => ({
      id: cluster.id,
      name: getI18nConfigCurrentText(cluster.name, languageId),
      disabled: !selectedAccount || !allowedClusters.has(cluster.id),
    }));
  }, [accountClusterMap, currentClusters, languageId, selectedAccount]);

  const selectedClusterInfo = useMemo(
    () => currentClusters.find((cluster) => cluster.id === selectedCluster),
    [currentClusters, selectedCluster],
  );

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

  const summaryClusterInfoQuery = useAsync({
    promiseFn: useCallback(async () => {
      if (!currentClusters.length) {
        return {
          results: [] as {
            clusterId: string;
            partitions: [];
          }[],
        };
      }
      const clusterIds = currentClusters.map((cluster) => cluster.id);
      return await api
        .getAllSummaryClustersInfo({
          query: {
            clusterIds,
            isFullDisplayMode,
          },
        })
        .httpError(500, () => ({ results: [] }));
    }, [currentClusters, isFullDisplayMode]),
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
    const summaryPartitions =
      summaryClusterInfoQuery.data?.results?.find((cluster) => cluster.clusterId === selectedCluster)?.partitions ?? [];

    // usage 为 0~100 的百分比，统一换算为 0~1
    const normalizeUsageRatio = (usage: number | undefined) => {
      if (usage == null || Number.isNaN(usage)) {
        return undefined;
      }
      const ratio = usage / 100;
      return Math.min(1, Math.max(0, ratio));
    };

    const calculateIdleCount = (total: number | undefined, usageRatio: number | undefined) => {
      if (total == null || usageRatio == null) {
        return undefined;
      }
      return Math.max(0, Math.round(total * (1 - usageRatio)));
    };

    return partitions.map((partition) => {
      const summary = summaryPartitions.find((item) => item.partitionName === partition.name);
      const nodeSpecParts = [
        partition.gpus ? t(pResource("nodeSpecGpu"), [partition.gpus]) : undefined,
        partition.cores ? t(pResource("nodeSpecCpu"), [partition.cores]) : undefined,
        partition.memMb ? t(pResource("nodeSpecMemory"), [formatSize(partition.memMb, ["MB", "GB", "TB"])]) : undefined,
      ].filter(Boolean);
      const nodeTotal = summary?.nodeCount;
      const cpuTotal = summary?.cpuCoreCount;
      const gpuTotal = summary?.gpuCoreCount;
      const nodeUsageRatio = normalizeUsageRatio(summary?.nodeUsage);
      const cpuUsageRatio = normalizeUsageRatio(summary?.cpuUsage);
      const gpuUsageRatio = normalizeUsageRatio(summary?.gpuUsage);
      const idleNodeCount = calculateIdleCount(nodeTotal, nodeUsageRatio);
      const idleCpuCount = calculateIdleCount(cpuTotal, cpuUsageRatio);
      const idleGpuCount = calculateIdleCount(gpuTotal, gpuUsageRatio);
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
    languageId,
    selectedAccount,
    selectedCluster,
    summaryClusterInfoQuery.data?.results,
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

  const formattedHourlyPrice = jobOneHourPrice == null ? "-" : `${jobOneHourPrice.toFixed(2)}${t(p("yuan"))}`;

  const [submitting, setSubmitting] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [pendingTemplatePartition, setPendingTemplatePartition] = useState<string | undefined>();
  const [pendingTemplateQos, setPendingTemplateQos] = useState<string | undefined>();
  const [unavailableParamsModal, setUnavailableParamsModal] = useState<{
    params: UnavailableParamRow[];
    applyFn: () => void;
  } | null>(null);

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
            maxTimeUnit: maxTimeUnit,
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
          Router.push("/jobs/runningJobs");
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
            jobName: templateName,
            account: resourceValues.account,
            partition: resourceValues.partition,
            qos: resourceValues.qos ?? "",
            nodeCount: resourceValues.nodeCount,
            coreCount: submitCoreCount,
            gpuCount: submitGpuCount,
            memoryMb: memoryMb ? `${memoryMb}MB` : "0MB",
            command: jobValues.command,
            maxTime: resourceValues.maxTime,
            maxTimeUnit,
          },
        })
        .httpError(404, (e) => {
          if (e.code === "UNIMPLEMENTED") {
            modal.error({ title: t(p("errorMessage")), content: e.message });
          } else {
            throw e;
          }
        })
        .httpError(429, () => {
          message.error(t(pCommon("noSpaceError")));
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

  const handleUseTemplate = async ({
    cluster,
    template,
  }: {
    cluster: string;
    template: Awaited<ReturnType<typeof api.getJobTemplate>>["template"];
  }) => {
    const nextResourceValues: Partial<ResourceFormValues> = {
      nodeCount: template.nodeCount,
      maxTime: template.maxTime,
    };
    const unavailableParams: UnavailableParamRow[] = [];

    if (template.account && accountOptions.some((option) => option.value === template.account)) {
      nextResourceValues.account = template.account;
    } else if (template.account) {
      unavailableParams.push({
        key: "account",
        label: t(pResource("accountLabel")),
        templateValue: template.account,
        recommendedValue: resourceForm.getFieldValue("account") ?? "-",
      });
    }

    const currentAccount = (nextResourceValues.account ?? resourceForm.getFieldValue("account")) as string | undefined;
    if (currentAccount && (accountClusterMap[currentAccount] ?? []).includes(cluster)) {
      nextResourceValues.cluster = cluster;
    } else {
      unavailableParams.push({
        key: "cluster",
        label: t(pResource("clusterLabel")),
        templateValue: cluster,
        recommendedValue: resourceForm.getFieldValue("cluster") ?? "-",
      });
    }

    const partitionCheckAccount = (nextResourceValues.account ?? resourceForm.getFieldValue("account")) as
      | string
      | undefined;
    const partitionCheckCluster = (nextResourceValues.cluster ?? resourceForm.getFieldValue("cluster")) as
      | string
      | undefined;

    let availablePartitions: Partition[] | undefined;
    if (partitionCheckAccount && partitionCheckCluster && (template.partition || template.qos)) {
      availablePartitions = await api
        .getAvailablePartitionsForCluster({
          query: {
            cluster: partitionCheckCluster,
            accountName: partitionCheckAccount,
          },
        })
        .then((res) => res.partitions)
        .catch(() => {
          return undefined;
        });
    }

    let matchedTemplatePartition: Partition | undefined;
    if (template.partition && availablePartitions) {
      const matchedPartition = availablePartitions.find((partition) => partition.name === template.partition);
      if (matchedPartition) {
        matchedTemplatePartition = matchedPartition;
        nextResourceValues.partition = template.partition;
        setPendingTemplatePartition(template.partition);

        if (template.qos && (matchedPartition.qos ?? []).includes(template.qos)) {
          nextResourceValues.qos = template.qos;
          setPendingTemplateQos(template.qos);
        } else if (template.qos) {
          unavailableParams.push({
            key: "qos",
            label: t(pResource("qosLabel")),
            templateValue: template.qos,
            recommendedValue: resourceForm.getFieldValue("qos") ?? "-",
          });
          setPendingTemplateQos(undefined);
        }
      } else {
        unavailableParams.push({
          key: "partition",
          label: t(pResource("partitionLabel")),
          templateValue: template.partition,
          recommendedValue: resourceForm.getFieldValue("partition") ?? "-",
        });
        setPendingTemplatePartition(undefined);
        setPendingTemplateQos(undefined);
      }
    } else if (template.partition) {
      unavailableParams.push({
        key: "partition",
        label: t(pResource("partitionLabel")),
        templateValue: template.partition,
        recommendedValue: resourceForm.getFieldValue("partition") ?? "-",
      });
      setPendingTemplatePartition(undefined);
      setPendingTemplateQos(undefined);
    } else {
      setPendingTemplatePartition(undefined);
      setPendingTemplateQos(undefined);
    }

    const useGpuTab = matchedTemplatePartition
      ? (matchedTemplatePartition.gpus ?? 0) > 0
      : !!template.gpuCount && template.gpuCount > 0;
    setActivePartitionTab(useGpuTab ? "gpu" : "cpu");
    if (useGpuTab) {
      nextResourceValues.gpuCores = template.gpuCount;
      nextResourceValues.cpuCores = undefined;
    } else {
      nextResourceValues.cpuCores = template.coreCount;
      nextResourceValues.gpuCores = undefined;
    }

    if (matchedTemplatePartition) {
      if (template.nodeCount > matchedTemplatePartition.nodes) {
        unavailableParams.push({
          key: "nodeCount",
          label: t(pResource("nodeCountLabel")),
          templateValue: String(template.nodeCount),
          recommendedValue: String(resourceForm.getFieldValue("nodeCount") ?? "-"),
        });
        delete nextResourceValues.nodeCount;
      }
      if (useGpuTab) {
        if (template.gpuCount && template.gpuCount > matchedTemplatePartition.gpus) {
          unavailableParams.push({
            key: "gpuCores",
            label: t(pResource("gpuCoresLabel")),
            templateValue: String(template.gpuCount),
            recommendedValue: String(resourceForm.getFieldValue("gpuCores") ?? "-"),
          });
          nextResourceValues.gpuCores = undefined;
        }
      } else {
        if (template.coreCount > matchedTemplatePartition.cores) {
          unavailableParams.push({
            key: "cpuCores",
            label: t(pResource("cpuCoresLabel")),
            templateValue: String(template.coreCount),
            recommendedValue: String(resourceForm.getFieldValue("cpuCores") ?? "-"),
          });
          nextResourceValues.cpuCores = undefined;
        }
      }
    }

    const applyFn = () => {
      resourceForm.setFieldsValue(nextResourceValues);
      setMaxTimeUnit(template.maxTimeUnit ?? TimeUnit.MINUTES);
      jobForm.setFieldValue("command", template.command);
      setTemplateListOpen(false);
    };

    if (unavailableParams.length > 0) {
      setUnavailableParamsModal({ params: unavailableParams, applyFn });
    } else {
      applyFn();
    }
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
      resourceForm.setFieldValue("nodeCount", initialValues.nodeCount ?? 1);
    }
    if (activePartitionTab === "gpu") {
      const gpuCoresNotSet = selectedGpuCores === undefined || selectedGpuCores === null;
      if (gpuCoresNotSet && !resourceForm.isFieldTouched("gpuCores")) {
        const nextGpuCores = initialValues.gpuCores ?? 1;
        resourceForm.setFieldValue("gpuCores", nextGpuCores);
      }
    } else {
      const cpuCoresNotSet = selectedCpuCores === undefined || selectedCpuCores === null;
      if (cpuCoresNotSet && !resourceForm.isFieldTouched("cpuCores")) {
        const nextCpuCores = initialValues.cpuCores ?? 1;
        resourceForm.setFieldValue("cpuCores", nextCpuCores);
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
    if (!accountOptions.length) {
      return;
    }
    const currentAccount = resourceForm.getFieldValue("account");
    if (!currentAccount || !accountOptions.some((option) => option.value === currentAccount)) {
      resourceForm.setFieldValue("account", accountOptions[0].value);
    }
  }, [accountOptions, resourceForm]);

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

  return (
    <>
      <PageContainer style={{ paddingBottom: "40px" }} direction="vertical" size={16}>
        <PaddedCard
          title={
            <HeaderRow align="center" size={16} style={{ justifyContent: "space-between" }}>
              <HeaderTitle>{t(p("title"))}</HeaderTitle>
              <Button type="link" style={{ padding: 0, fontSize: 16 }} onClick={() => setTemplateListOpen(true)}>
                {t(p("templateButton"))}
              </Button>
            </HeaderRow>
          }
        >
          <BorderlessCard title={<SectionTitle>{t(p("basicInfoSectionTitle"))}</SectionTitle>}>
            <BaseInfoSection form={baseForm} jobName={jobName} onJobNameChange={handleJobNameChange} />
          </BorderlessCard>
        </PaddedCard>

        <ResourceConfigSection
          form={resourceForm}
          accountOptions={accountOptions}
          accountLoading={isGetAvailableAccountsAndClusters}
          clusterOptions={clusterOptions}
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
        />
      </PageContainer>

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
        <FooterStats>
          <span>
            {t(p("totalNodeCount"))} <FooterStatValue>{selectedNodeCount ?? "-"}</FooterStatValue>
          </span>
          <span>
            {t(p("totalGpuCount"))} <FooterStatValue>{totalGpuCount}</FooterStatValue>
          </span>
          <span>
            {t(p("totalCoreCount"))} <FooterStatValue>{totalCpuCount}</FooterStatValue>
          </span>
          <span>
            {t(p("totalMemory"))} <FooterStatValue>{totalMemory}</FooterStatValue>
          </span>
          <span>
            {t(p("costPerHour"))} <FooterStatValue $isPrimaryColor>{formattedHourlyPrice}</FooterStatValue>
          </span>
          <a
            onClick={() => {
              window.open(join(publicConfig.MIS_URL ?? "/mis", "/user/partitions"), "_blank", "noopener,noreferrer");
            }}
          >
            <FooterStatValue $isPrimaryColor>{t(p("pricingStandard"))}</FooterStatValue>
          </a>
        </FooterStats>
        <FooterActions>
          <AntdButton type="primary" onClick={handleSubmit} loading={submitting}>
            {t(p("submitButton"))}
          </AntdButton>
        </FooterActions>
      </FixedFooter>

      <SaveAsTemplateModal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} onSave={handleSaveAsTemplate} />
      <TemplateListModal
        clusterIds={clusterOptions.map((cluster) => cluster.id)}
        open={templateListOpen}
        onUse={handleUseTemplate}
        onClose={() => setTemplateListOpen(false)}
      />
      <StyledModal
        open={!!unavailableParamsModal}
        title={t(p("unavailableParamsTitle"))}
        onOk={() => {
          unavailableParamsModal?.applyFn();
          setUnavailableParamsModal(null);
        }}
        onCancel={() => setUnavailableParamsModal(null)}
        okText={t(p("unavailableParamsConfirm"))}
        cancelText={t(p("unavailableParamsCancel"))}
        centered
        width={448}
      >
        <Typography.Paragraph style={{ marginBottom: 16, color: gray[7] }}>{t(p("unavailableParamsDesc"))}</Typography.Paragraph>
        <TableWithSplitLines
          dataSource={unavailableParamsModal?.params ?? []}
          pagination={false}
          size="small"
          style={{ marginBottom: 32 }}
          columns={[
            {
              title: "",
              dataIndex: "label",
              key: "label",
            },
            {
              title: t(p("unavailableParamColumn")),
              dataIndex: "templateValue",
              key: "templateValue",
              render: (val: string) => <Typography.Text type="danger">{val}</Typography.Text>,
            },
            {
              title: t(p("recommendedParamColumn")),
              dataIndex: "recommendedValue",
              key: "recommendedValue",
            },
          ]}
        />
      </StyledModal>
    </>
  );
};
