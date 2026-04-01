import { BorderlessCard, HeaderRow, HeaderTitle, PaddedCard }
  from "@scow/lib-web/build/components/styledAntdCom/DualTitleCard";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { PageContainer } from "@scow/lib-web/build/layouts/base/PageContainer";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Avatar, Button, Divider, Form, Typography } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import { join } from "path";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ReservedAppAttributeName } from "src/models/job";
import { CommandSelectReservedConfig, FixedValueConfig, ReservedAppAttribute,
  SelectConfig } from "src/pages/api/app/getAppMetadata";
import { Partition } from "src/pages/api/cluster";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { formatSize } from "src/utils/format";
import { styled } from "styled-components";

import { FixedFooter, FooterActions, FooterStats, FooterStatValue } from "@scow/lib-web/build/components/job/Footer";
import { AppConfigSection } from "./CreateAppCom/AppConfigSection";
import { AppResourceFormValues,FixedOrEditableFormItem,
  getSelectAttributeInitalValue } from "./CreateAppCom/FixedOrEditableFormItem";
import { ResourceConfigSection } from "./CreateAppCom/ResourceConfigSection";

interface App { id: string; name: string; logoPath?: string; availableAccounts?: string[] };


const Text = styled(Typography.Paragraph)`
`;

const HeaderAvatar = styled(Avatar)`
  background-color: rgba(240, 240, 240, 1) !important;
`;

interface Props {
  appInfo: App | undefined;
  availableAccounts: string[];
  allAvailableAccounts: string[];
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
type TimeUnit = "min" | "hour" | "day";

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

// 生成默认应用名称，命名规则为"集群Id-当前应用名-年月日-时分秒"
const genAppJobName = (clusterId: string,appName: string): string => {
  return `${clusterId}-${appName}-${dayjs().format("YYYYMMDD-HHmmss")}`;
};

const p = prefix("pageComp.app.launchAppForm.");
const pCommon = prefix("common.");
const pResource = prefix("pageComp.submitJobCom.ResourceConfigSection.");

export const LaunchAppForm: React.FC<Props> = ({
  appInfo, availableAccounts, allAvailableAccounts, accountAppClusterMap,
  preSelectedCluster, setSelectedAppInfo, setSelectedCluster }) => {

  const { id: appId, name: appName, logoPath: appLogoPath } = appInfo || { id: "", name: "" };
  const { currentClusters } = useStore(ClusterInfoStore);

  const { message, modal } = App.useApp();
  const { user } = useStore(UserStore);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const isFullDisplayMode = useMemo(() => {
    return user?.isAdmin || publicConfig.DASHBOARD_USER_DISPLAY_MODE === "full";
  }, [user]);


  const [baseForm] = Form.useForm<FormFields>();
  const [resourceForm] = Form.useForm<AppResourceFormValues>();
  const [appForm] = Form.useForm<FormFields>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePartitionTab, setActivePartitionTab] = useState<PartitionTabKey>("cpu");

  const [maxTimeUnitValue, setMaxTimeUnitValue] = useState<TimeUnit>("min");

  const selectedAccount = Form.useWatch("account", resourceForm);
  const selectedCluster = Form.useWatch<string>("cluster", resourceForm);
  const selectedPartition = Form.useWatch("partition", resourceForm);
  const selectedQos = Form.useWatch<string | undefined>("qos", resourceForm);
  const nodeCount = Form.useWatch("nodeCount", resourceForm);
  const coreCount = Form.useWatch("coreCount", resourceForm);
  const gpuCount = Form.useWatch("gpuCount", resourceForm);
  const maxTime = Form.useWatch<number | undefined>("maxTime", resourceForm);

  const router = useRouter();

  // 获取应用信息
  const { data: appMetadataResult } = useAsync({
    promiseFn: useCallback(async () => {
      if (selectedCluster) {
        const result = await api.getAppMetadata({ query: { appId, cluster: selectedCluster } })
          .httpError(404, () => { message.error(t("pages.apps.create.error404")); })
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
  const appMetadata = (!selectedCluster || appMetadataResult?.cluster === selectedCluster) ? appMetadataResult : undefined;

  const { appComment, appCustomFormAttributes: attributes = [],
    reservedAppAttributes } = appMetadata ?? {};

  const appCommentI18nText = appComment ?
    getI18nConfigCurrentText(appComment, languageId) : undefined;

  // 判断系统保留APP字段:账户及分区或qos 是否已配置为固定值字段
  const fixedAccountName =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT);
  const fixedPartitionName =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.PARTITION);
  const fixedQosName =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.QOS);

  const fixedNodeCountValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.NODE_COUNT);
  const fixedCoreCountValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.CORE_COUNT);
  const fixedGpuCountValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.GPU_COUNT);
  const fixedMaxTimeValue =
    getInitialFixedValueByAttributeName(reservedAppAttributes, ReservedAppAttributeName.MAX_TIME);

  // 判断系统保留APP字段是否配置为了固定值选项
  const fixedAccountList
     = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT)
       .map((x) => x.toString());
  const fixedPartitionList
     = getFixedValueListByAttributeName(reservedAppAttributes, ReservedAppAttributeName.PARTITION)
       .map((x) => x.toString());

  const initialValues = {
    nodeCount: fixedNodeCountValue ? parseInt(fixedNodeCountValue, 10) : 1,
    coreCount: fixedCoreCountValue ? parseInt(fixedCoreCountValue, 10) : 1,
    gpuCount: fixedGpuCountValue ? parseInt(fixedGpuCountValue, 10) : 1,
    maxTime: fixedMaxTimeValue ? parseInt(fixedMaxTimeValue, 10) : 60,
  } as Partial<FormFields>;

  // 获取集群信息
  const summaryClusterInfoQuery = useAsync({
    promiseFn: useCallback(async () => {
      if (!currentClusters.length) {
        return {
          results: [] as {
            clusterId: string; partitions: []
          }[],
        };
      }
      const clusterIds = currentClusters.map((cluster) => cluster.id);
      return await api.getAllSummaryClustersInfo({ query: {
        clusterIds, isFullDisplayMode,
      } }).httpError(500, () => ({ results: []}));
    }, [currentClusters, isFullDisplayMode]),
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
        })
        return {
          cluster: selectedCluster,
          accountName: selectedAccount,
          partitions: result.partitions,
        };
      };
      return {
        cluster: selectedCluster,
        accountName: selectedAccount,
        partitions: [] as Partition[],
      };
    }, [selectedAccount, selectedCluster]),
  });

  const partitionRows: PartitionRow[] = useMemo(() => {
    if (!selectedCluster || !selectedAccount) {
      return [];
    }
    const hasMatchedPartitionData = !availablePartitionsForAccountQuery.isLoading
      && availablePartitionsForAccountQuery.data?.cluster === selectedCluster
      && availablePartitionsForAccountQuery.data?.accountName === selectedAccount;
    const partitions = hasMatchedPartitionData
      ? (availablePartitionsForAccountQuery.data?.partitions ?? [])
      : [];
    const summaryPartitions = summaryClusterInfoQuery.data?.results
      ?.find((cluster) => cluster.clusterId === selectedCluster)
      ?.partitions ?? [];

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

    const partitionsInfo = partitions.map((partition) => {
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
      const idleNodes = nodeTotal != null && idleNodeCount != null
        ? `${idleNodeCount}/${nodeTotal}`
        : "-";
      const idleCpu = cpuTotal != null && idleCpuCount != null
        ? `${idleCpuCount}/${cpuTotal}`
        : "-";
      const idleGpu = gpuTotal != null && idleGpuCount != null
        ? `${idleGpuCount}/${gpuTotal}`
        : "-";
      const kind: PartitionTabKey = partition.gpus && partition.gpus > 0 ? "gpu" : "cpu";
      const disabled = kind === "gpu"
        ? (idleGpuCount != null ? idleGpuCount <= 0 : false)
        : (idleCpuCount != null ? idleCpuCount <= 0 : false);

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

     if (partitionsInfo?.length > 0) {
      const hasCpuPartition = partitionsInfo.some(p => p.kind === "cpu");
      const hasGpuPartition = partitionsInfo.some(p => p.kind === "gpu");

      if (activePartitionTab === "cpu" && !hasCpuPartition && hasGpuPartition) {
        setActivePartitionTab("gpu");
      } else if (activePartitionTab === "gpu" && !hasGpuPartition && hasCpuPartition) {
        setActivePartitionTab("cpu");
      }
    }
    return partitionsInfo;
  }, [
    availablePartitionsForAccountQuery.isLoading,
    availablePartitionsForAccountQuery.data?.partitions,
    languageId,
    selectedAccount,
    selectedCluster,
    summaryClusterInfoQuery.data?.results,
  ]);

  const accountOptions = useMemo(() => {
    if (fixedAccountList.length > 0) {
      return fixedAccountList;
    }
    return allAvailableAccounts;
  }, [allAvailableAccounts, fixedAccountList]);

  const clusterOptions = useMemo(() => {
    // 使用复合 map 精确判断：该账户在该 app 下，在哪些集群可用
    const validClusters = new Set<string>(
      selectedAccount && appInfo?.id
        ? (accountAppClusterMap.get(`${selectedAccount}::${appInfo.id}`) ?? [])
        : [],
    );

    return currentClusters.map((cluster) => ({
      id: cluster.id,
      name: getI18nConfigCurrentText(cluster.name, languageId),
      disabled: !selectedAccount || !validClusters.has(cluster.id),
    }));
  }, [accountAppClusterMap, currentClusters, languageId, selectedAccount, appInfo?.id]);

  const qosOptions = useMemo(() => {
    if (!selectedPartition) {
      return [];
    }
    const partitions = availablePartitionsForAccountQuery.data?.partitions ?? [];
    return partitions.find((partition) => partition.name === selectedPartition)?.qos ?? [];
  }, [availablePartitionsForAccountQuery.data?.partitions, selectedPartition]);

  const selectedPartitionInfo = useMemo(() => {
    if (!selectedPartition) {
      return undefined;
    }
    const hasMatchedPartitionData = !availablePartitionsForAccountQuery.isLoading
      && availablePartitionsForAccountQuery.data?.cluster === selectedCluster
      && availablePartitionsForAccountQuery.data?.accountName === selectedAccount;
    const partitions = hasMatchedPartitionData
      ? (availablePartitionsForAccountQuery.data?.partitions ?? [])
      : [];
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
  }, [
    activePartitionTab,
    coreCount,
    gpuCount,
    nodeCount,
    selectedPartitionInfo,
  ]);

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
  }, [
    activePartitionTab,
    coreCount,
    gpuCount,
    nodeCount,
    selectedPartitionInfo,
  ]);

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

  const formattedHourlyPrice = jobOneHourPrice == null
    ? "-"
    : `${jobOneHourPrice.toFixed(2)}元`;

  const createErrorModal = (message: string) => modal.error({
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

  const handleSubmit = async () => {
    const baseFormFields = await baseForm.validateFields();
    const resourceFormFields = await resourceForm.validateFields();
    const appFormFields = await appForm.validateFields();
    const allFormFields = { ...baseFormFields, ...resourceFormFields, ...appFormFields };
    const { appJobName, nodeCount, coreCount, gpuCount, partition, qos, account, maxTime } = allFormFields;

    const customFormKeyValue: Record<string, string> = {};
    attributes.forEach((customFormAttribute) => {
      const customFormKey = customFormAttribute.name;
      customFormKeyValue[customFormKey] = allFormFields[customFormKey];
    });

    setIsSubmitting(true);
    await api.createAppSession({ body: {
      cluster: selectedCluster,
      appId,
      appName: appName || "",
      appJobName: appJobName,
      nodeCount: nodeCount,
      coreCount: gpuCount ? gpuCount * Math.floor(selectedPartitionInfo!.cores / selectedPartitionInfo!.gpus) : coreCount,
      gpuCount,
      memoryMb: totalMemoryMb,
      partition,
      qos,
      account,
      maxTime: transformTime(maxTime),
      customAttributes: customFormKeyValue,
    } })
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
          const clusterName = getI18nConfigCurrentText(currentClusters.find((cluster) => cluster.id ==
          selectedCluster)?.name ?? selectedCluster, languageId);
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
      .httpError(429, () => { message.error(t(pCommon("noSpaceError"))); })
      .then(() => {
        message.success(t(p("successMessage")));
        const searchParams = new URLSearchParams(window.location.search);
        const callbackPath = searchParams.get("callbackPath");

        if (callbackPath) {
          window.location.href = callbackPath;
        } else {
          router.push("/apps/sessions");
        }
      }).finally(() => {
        setIsSubmitting(false);
      });
  };

  const transformTime = (amount: number) => {
    switch (maxTimeUnitValue) {
      case "hour":
        return amount * 60;
      case "day":
        return amount * 60 * 24;
      default:
        return amount;
    }
  };

  useEffect(() => {
    if (selectedCluster) {
      resourceForm.setFieldValue("cluster", selectedCluster);
      setSelectedCluster(selectedCluster);
      baseForm.setFieldValue("appJobName", genAppJobName(selectedCluster, appName || ""));
    }
  }, [baseForm, selectedCluster]);

  useEffect(() => {
    if (fixedQosName || !qosOptions.length) return;
    if (!selectedQos || !qosOptions.includes(selectedQos)) {
      resourceForm.setFieldValue("qos", qosOptions[0]);
    }

  }, [qosOptions, resourceForm, selectedQos]);

  useEffect(() => {
    if (!selectedPartitionInfo) {
      return;
    }
    const nodeCountNotSet = nodeCount === undefined || nodeCount === null;
    if (nodeCountNotSet && !resourceForm.isFieldTouched("nodeCount")) {
      resourceForm.setFieldValue("nodeCount", initialValues.nodeCount ?? 1);
    }

    if (activePartitionTab === "gpu") {
      if (gpuCount === undefined || gpuCount === null || gpuCount === 0) {
        resourceForm.setFieldValue("gpuCount", 1);
      }
    } else {
      if (coreCount === undefined || coreCount === null || coreCount === 0) {
        resourceForm.setFieldValue("coreCount", 1);
      }
    }
  }, [
    activePartitionTab,
    resourceForm,
    selectedPartitionInfo,
  ]);

  useEffect(() => {
    const maxTimeNotSet = maxTime === undefined || maxTime === null;
    if (maxTimeNotSet && !resourceForm.isFieldTouched("maxTime")) {
      resourceForm.setFieldValue("maxTime", initialValues.maxTime ?? 60);
    }
  }, [resourceForm, maxTime]);

  useEffect(() => {
    if (!accountOptions.length) return;
    if(selectedAccount && fixedAccountList) return;
    const currentAccount = resourceForm.getFieldValue("account");
    if (currentAccount && accountOptions.includes(currentAccount)) return;

    // 有预选集群时，优先选当前集群中有效的账户；否则取 accountOptions 第一项
    const defaultAccount = preSelectedCluster
      ? (availableAccounts.find((a) => accountOptions.includes(a)) ?? accountOptions[0])
      : accountOptions[0];

    resourceForm.setFieldValue("account", defaultAccount);
  }, [accountOptions, availableAccounts, preSelectedCluster, resourceForm, fixedAccountList]);

  useEffect(() => {
    if (!partitionRows.length) {
      return;
    }

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
  }, [activePartitionTab, partitionRows, resourceForm]);

  // 当分区通过固定选项下拉框选择时，同步 activePartitionTab
  useEffect(() => {
    if (!selectedPartition || !partitionRows.length) return;
    const row = partitionRows.find((r) => r.key === selectedPartition);

    if (row && row.kind !== activePartitionTab) {
      setActivePartitionTab(row.kind);
    }
  }, [selectedPartition, partitionRows]);

  // 验证当前选择的集群是否有效
  // 如果当前集群无效，自动选择一个有效的集群
  useEffect(() => {
    if (!selectedAccount) {
      resourceForm.setFieldValue("cluster", undefined);
      return;
    }
    const currentCluster = resourceForm.getFieldValue("cluster");
    const clusterValid = currentCluster
      && clusterOptions.some((option) => option.id === currentCluster && !option.disabled);
    const preferredClusterValid = preSelectedCluster
      && clusterOptions.some((option) => option.id === preSelectedCluster && !option.disabled);
    if (!clusterValid) {
      const firstEnabledCluster = clusterOptions.find((option) => !option.disabled)?.id;
      resourceForm.setFieldValue("cluster", preferredClusterValid ? preSelectedCluster : firstEnabledCluster);
    }
  }, [clusterOptions, resourceForm, selectedAccount]);

  return (
    <>
      <PageContainer style={{ paddingBottom: "40px" }} direction="vertical" size={16}>
        <PaddedCard
          title={(
            <HeaderRow align="center" size={16}>
              {appLogoPath ? (
                <HeaderAvatar
                  size={32}
                  src={ join(publicConfig.PUBLIC_PATH, appLogoPath) }
                />
              ) : null}
              <HeaderTitle>
                {t(p("create")) + appName}
              </HeaderTitle>
            </HeaderRow>
          )}
        >
          <BorderlessCard title={<SectionTitle>{t(p("basicInfoSectionTitle"))}</SectionTitle>}>
            <Form
              form={baseForm}
              colon={false}
              requiredMark={false}
            >
              <FixedOrEditableFormItem
                form={baseForm}
                languageId={languageId}
                t={t}
                name="appJobName"
                label={<FormLabel>{t(p("appJobName"))}</FormLabel>}
                rules={[{ required: true, message: t(p("jobNameRequired")) }, { max: 50 }]}
                reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes,
                  ReservedAppAttributeName.APP_JOB_NAME)}
                children={(
                  <RoundedInput />
                )}
                currentPartitionIsWithGpu={!!selectedPartitionInfo?.gpus}
                appId={appId}
                clusterId={selectedCluster}
              />
            </Form>
          </BorderlessCard>
        </PaddedCard>

        <ResourceConfigSection
          form={resourceForm}
          accountOptions={accountOptions}
          clusterOptions={clusterOptions}
          selectedCluster={selectedCluster}
          partitionRows={partitionRows}
          activePartitionTab={activePartitionTab}
          onActivePartitionTabChange={setActivePartitionTab}
          selectedPartitionKey={selectedPartition}
          onPartitionSelect={(value) =>{ resourceForm.setFieldValue("partition", value) }}
          qosOptions={qosOptions}
          inputsDisabled={inputsDisabled}
          maxTimeUnit={maxTimeUnitValue}
          onMaxTimeUnitChange={setMaxTimeUnitValue}
          languageId={languageId}
          appId={appId}
          clusterId={selectedCluster}
          reservedAppAttributes={reservedAppAttributes}
          currentPartitionInfo={selectedPartitionInfo}
        />

        <AppConfigSection
          form={appForm}
          languageId={languageId}
          appId={appId}
          clusterId={selectedCluster}
          attributes={attributes}
          currentPartitionInfo={selectedPartitionInfo}
        />

        {
          appCommentI18nText && (
            <div style={{ marginTop: "64px" }}>
              <Divider />
              <PageTitle titleText={t(p("appCommentTitle"))} />
              <Text>
                <div
                  dangerouslySetInnerHTML={{ __html: appCommentI18nText }}
                />
              </Text>
            </div>
          )
        }
      </PageContainer>

      <FixedFooter>
        <FooterStats>
          <span>{t(p("totalNodeCount"))} <FooterStatValue>{nodeCount ?? "-"}</FooterStatValue></span>
          <span>{t(p("totalGpuCount"))} <FooterStatValue>{totalGpuCount}</FooterStatValue></span>
          <span>{t(p("totalCoreCount"))} <FooterStatValue>{totalCpuCount}</FooterStatValue></span>
          <span>{t(p("totalMemory"))} <FooterStatValue>{totalMemory}</FooterStatValue></span>
          <span>{t(p("costPerHour"))} <FooterStatValue $isPrimaryColor>{formattedHourlyPrice}</FooterStatValue></span>
          <a
            onClick={() => {
              window.open(join(publicConfig.MIS_URL ?? "/mis", "/user/partitions"), "_blank", "noopener,noreferrer");
            }}
          >
            <FooterStatValue $isPrimaryColor>{t(p("pricingStandard"))}</FooterStatValue>
          </a>
        </FooterStats>
        <FooterActions>
          <Button
            onClick={() => {
              const searchParams = new URLSearchParams(window.location.search);
              const callbackPath = searchParams.get("callbackPath");

              if (callbackPath) {
                window.location.href = callbackPath;
              } else {
                setSelectedAppInfo(undefined);
              }
            }}
            style={{ marginRight: "10px" }}
          >
            {t("button.cancelButton")}
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={isSubmitting}>
            {t("button.submitButton")}
          </Button>
        </FooterActions>
      </FixedFooter>
    </>
  );
};

// 在已配置固定值或固定选项时，获取系统保留字段的对应formField的固定值初始值
const getInitialFixedValueByAttributeName = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): string | undefined => {

  const attribute = reservedAppAttributes?.find((x) => x.name === attributeName);

  if (!attribute) {
    return undefined;
  }

  // 根据配置类型返回初始值
  if (attribute.reservedConfig.type === "fixedValue") {
    return attribute.reservedConfig.fixedValue.value.toString();
  } else if (attribute.reservedConfig.type === "select") {
    const value = getSelectAttributeInitalValue(
      attribute.reservedConfig.defaultValue,
      attribute.reservedConfig.select,
    );
    return value?.toString();
  }

  return undefined;
};

// 在已配置固定值或固定选项时，获取系统保留字段的对应formField的固定值初始值
const getFixedValueListByAttributeName = (
  reservedAppAttributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): (string | number)[] => {

  const attribute = reservedAppAttributes?.find((x) => x.name === attributeName);

  if (!attribute) {
    return [];
  }

  // 根据配置类型返回初始值
  if (attribute.reservedConfig.type === "select") {
    return attribute.reservedConfig.select.map((x) => (x.value));
  }

  return [];
};

export const getReservedAppAttributeConfig = (
  attributes: ReservedAppAttribute[] | undefined,
  attributeName: ReservedAppAttributeName,
): FixedValueConfig | SelectConfig | CommandSelectReservedConfig | undefined => {
  return attributes?.find((x) => (x.name === attributeName))?.reservedConfig;
};
