import type { InputNumberProps } from "antd";
import type { ColumnsType } from "antd/es/table";

import { RoundedButton as ClusterButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { AddonAfterSelect, RoundedInputNumberWithAddonAfter } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedInputNumber } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { StyledTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { StyledTabs } from "@scow/lib-web/build/components/styledAntdCom/Tabs";
import {
  SectionTitle,
  TitledSectionCard as SectionCard,
} from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { validateConfigMaxJobRunningHours } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance, Select, Space, Tooltip } from "antd";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { type ClusterNodesInfo, getMaxPodsByNodes, getQueueNodes } from "src/app/(auth)/jobs/common";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { useQueueTabSelection } from "src/app/(auth)/jobs/hooks/useQueueTabSelection";
import { prefix, useI18nTranslateToString } from "src/i18n";

import type {
  CPUQueueRow,
  GPUQueueRow,
  MaxTimeUnit,
  QueueKind,
  QueueRow,
  ResourceFormValues,
  TrainFramework,
} from "../LaunchTrainForm.types";

import { FrameworkSegmentedControl, InlineAddonInputGroup } from "../LaunchTrainForm.styles";
import { CommonHelpTipWithQuestionMark } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";

const p = prefix("app.jobs.resourceConfigSection.");
const DISTRIBUTED_FRAMEWORKS: TrainFramework[] = ["pytorch", "mpi", "mindspore"];

interface Option {
  label: string;
  value: string;
}

interface ClusterOption {
  id: string;
  name: string;
  disabled: boolean;
}

interface ResourceConfigSectionProps {
  form: FormInstance<ResourceFormValues>;
  accountOptions: Option[];
  clusterOptions: ClusterOption[];
  selectedCluster?: string;
  activeResourceTab: QueueKind;
  onActiveResourceTabChange: (tab: QueueKind) => void;
  gpuColumns: ColumnsType<GPUQueueRow>;
  cpuColumns: ColumnsType<CPUQueueRow>;
  gpuRows: GPUQueueRow[];
  cpuRows: CPUQueueRow[];
  queueLoading: boolean;
  selectedQueueKey?: string;
  onQueueSelect: (queueId: string | undefined) => void;
  selectedQueueOption?: QueueRow;
  queueNodesInfo?: ClusterNodesInfo;
  qosOptions: string[];
  maxTimeUnit: MaxTimeUnit;
  onMaxTimeUnitChange: (unit: MaxTimeUnit) => void;
  maxJobRunningTimeHours?: number;
  frameworkOptions: TrainFramework[];
  gpuUnitLimit?: number;
  isResubmit?: boolean;
}

type AddonNumberInputProps = {
  addonLabel: ReactNode;
  value?: InputNumberProps<string | number>["value"];
  onChange?: InputNumberProps<string | number>["onChange"];
} & Omit<InputNumberProps<string | number>, "value" | "onChange">;

const AddonNumberInput = ({ addonLabel, value, onChange, ...inputProps }: AddonNumberInputProps) => (
  <InlineAddonInputGroup size="large">
    <div className="addon-label">{addonLabel}</div>
    <RoundedInputNumber className="addon-input" size="large" value={value} onChange={onChange} {...inputProps} />
  </InlineAddonInputGroup>
);

export const ResourceConfigSection = ({
  form,
  accountOptions,
  clusterOptions,
  selectedCluster,
  activeResourceTab,
  onActiveResourceTabChange,
  gpuColumns,
  cpuColumns,
  gpuRows,
  cpuRows,
  queueLoading,
  selectedQueueKey,
  onQueueSelect,
  selectedQueueOption,
  queueNodesInfo,
  qosOptions,
  maxTimeUnit,
  onMaxTimeUnitChange,
  maxJobRunningTimeHours,
  frameworkOptions,
  gpuUnitLimit,
  isResubmit,
}: ResourceConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const { sortedGpuRows, sortedCpuRows, handleTabChange, markAccountTouched, markClusterTouched } =
    useQueueTabSelection({
      gpuRows,
      cpuRows,
      activeResourceTab,
      onActiveResourceTabChange,
      selectedQueueKey,
      onQueueSelect,
      syncQueueField: (tab) => form.setFieldValue("queue", tab),
      isResubmit,
    });

  const gpuTab = {
    key: "gpu",
    label: t(p("tabs.gpu")),
    children: (
      <StyledTable
        bordered
        size="small"
        pagination={false}
        rowKey="id"
        columns={gpuColumns}
        dataSource={sortedGpuRows}
        loading={queueLoading}
        rowSelection={{
          type: "radio",
          selectedRowKeys: activeResourceTab === "gpu" && selectedQueueKey ? [selectedQueueKey] : [],
          onChange: (keys) => onQueueSelect(keys[0] as string),
          getCheckboxProps: () => ({ disabled: false }),
        }}
        rowClassName={(record) => {
          if (record.id === selectedQueueKey) return "selected-row";
          return "";
        }}
      />
    ),
  };

  const cpuTab = {
    key: "cpu",
    label: t(p("tabs.cpu")),
    children: (
      <StyledTable
        bordered
        size="small"
        pagination={false}
        rowKey="id"
        columns={cpuColumns}
        dataSource={sortedCpuRows}
        loading={queueLoading}
        rowSelection={{
          type: "radio",
          selectedRowKeys: activeResourceTab === "cpu" && selectedQueueKey ? [selectedQueueKey] : [],
          onChange: (keys) => onQueueSelect(keys[0] as string),
          getCheckboxProps: () => ({ disabled: false }),
        }}
        rowClassName={(record) => (activeResourceTab === "cpu" && record.id === selectedQueueKey ? "selected-row" : "")}
      />
    ),
  };

  const frameworkValue = Form.useWatch<TrainFramework>("framework", form) ?? frameworkOptions[0];
  const psNodeCountValue = Form.useWatch<number>("psNodeCount", form);
  const workerNodeCountValue = Form.useWatch<number>("workerNodeCount", form);
  const distributedNodeCountValue = Form.useWatch<number>("distributedNodeCount", form);
  const inputsDisabled = !selectedQueueOption;
  const isTensorflow = frameworkValue === "tensorflow";
  const isDistributedFramework = DISTRIBUTED_FRAMEWORKS.includes(frameworkValue);
  const unitLabel =
    frameworkValue === "single"
      ? t(p(activeResourceTab === "gpu" ? "frameworkFields.singleGpu" : "frameworkFields.singleCpu"))
      : t(p(activeResourceTab === "gpu" ? "frameworkFields.nodeGpu" : "frameworkFields.nodeCpu"));
  const queueTotalUnits = selectedQueueOption?.totalUnits ?? 0;
  const queueTotalNodes = selectedQueueOption?.totalNodes ?? 1;
  const perNodeUnitLimit = queueTotalUnits > 0 && queueTotalNodes > 0 ? queueTotalUnits / queueTotalNodes : undefined;
  const perPodLimit = activeResourceTab === "gpu" && gpuUnitLimit && gpuUnitLimit > 0 ? gpuUnitLimit : undefined;

  const selectedQueueNodes = useMemo(
    () => getQueueNodes(queueNodesInfo, selectedQueueOption?.queue),
    [queueNodesInfo, selectedQueueOption],
  );

  const normalizedPsNodes = Math.max(0, Number(psNodeCountValue ?? 0));
  const normalizedWorkerNodes = Math.max(1, Number(workerNodeCountValue ?? 1));
  const normalizedDistributedNodes = Math.max(2, Number(distributedNodeCountValue ?? 2));
  const effectiveNodeCount = (() => {
    if (isTensorflow) {
      return Math.max(1, normalizedPsNodes + normalizedWorkerNodes);
    }
    if (isDistributedFramework) {
      return Math.max(1, normalizedDistributedNodes);
    }
    return 1;
  })();
  const perNodeMax =
    queueTotalUnits > 0 && effectiveNodeCount > 0 ? Math.floor(queueTotalUnits / effectiveNodeCount) : undefined;
  const nodeUnitCandidates = [];
  if (perNodeMax && perNodeMax >= 1) {
    nodeUnitCandidates.push(perNodeMax);
  }
  if (perNodeUnitLimit && perNodeUnitLimit >= 1) {
    nodeUnitCandidates.push(perNodeUnitLimit);
  }
  if (perPodLimit) {
    nodeUnitCandidates.push(perPodLimit);
  }
  const nodeUnitMax = nodeUnitCandidates.length ? Math.min(...nodeUnitCandidates) : undefined;

  const tensorflowTotalValidator = () => {
    if (!isTensorflow) {
      return Promise.resolve();
    }
    const psNodes = Number(form.getFieldValue("psNodeCount") ?? 0);
    const workerNodes = Number(form.getFieldValue("workerNodeCount") ?? 0);
    if (psNodes + workerNodes < 2) {
      return Promise.reject(new Error(t(p("frameworkValidation.tensorflowTotal"))));
    }
    return Promise.resolve();
  };

  const queueCapacityValidator = () => {
    if (!selectedQueueOption || queueTotalUnits <= 0) {
      return Promise.resolve();
    }
    const perNodeUnits = Number(form.getFieldValue("nodeUnitCount"));
    if (!perNodeUnits || Number.isNaN(perNodeUnits)) {
      return Promise.resolve();
    }
    const psNodes = Number(form.getFieldValue("psNodeCount") ?? 0);
    const workerNodes = Number(form.getFieldValue("workerNodeCount") ?? 0);
    const distributedNodes = Number(form.getFieldValue("distributedNodeCount") ?? 0);

    let nodeMultiplier = 1;
    if (isTensorflow) {
      nodeMultiplier = Math.max(1, psNodes + workerNodes);
    } else if (isDistributedFramework) {
      nodeMultiplier = Math.max(1, distributedNodes);
    }

    if (nodeMultiplier <= 0) {
      return Promise.resolve();
    }

    if (perPodLimit && perNodeUnits > perPodLimit) {
      return Promise.reject(new Error(t(p("frameworkValidation.queueLimit"), [unitLabel, perPodLimit.toString()])));
    }

    if (perNodeUnitLimit && perNodeUnits > perNodeUnitLimit) {
      return Promise.reject(
        new Error(t(p("frameworkValidation.queueLimit"), [unitLabel, perNodeUnitLimit.toString()])),
      );
    }

    // 节点的总容量限制
    if (selectedQueueNodes.length) {
      const memoryPerUnitMb =
        selectedQueueOption.type === "gpu" ? selectedQueueOption.memoryPerGpuMb : selectedQueueOption.memoryPerCoreMb;
      const { maxPods } = getMaxPodsByNodes({
        nodes: selectedQueueNodes,
        queueType: selectedQueueOption.type,
        perNodeUnits,
        memoryPerUnitMb,
      });

      if (maxPods !== undefined && nodeMultiplier > maxPods) {
        return Promise.reject(
          new Error(t(p("frameworkValidation.nodeLimit"), [unitLabel, perNodeUnits.toString(), maxPods.toString()])),
        );
      }
    }

    // 队列的容量限制
    if (perNodeUnits * nodeMultiplier > queueTotalUnits) {
      return Promise.reject(new Error(t(p("frameworkValidation.queueLimit"), [unitLabel, queueTotalUnits.toString()])));
    }
    return Promise.resolve();
  };

  const requiredNumberValidator = (message: string) => (_: unknown, value: number | string | null) => {
    if (value === undefined || value === null || value === "") {
      return Promise.reject(new Error(message));
    }
    return Promise.resolve();
  };

  const hadQueueSelectionRef = useRef(false);

  useEffect(() => {
    if (selectedQueueOption) {
      hadQueueSelectionRef.current = true;
      form
        .validateFields(["nodeUnitCount", "psNodeCount", "workerNodeCount", "distributedNodeCount"])
        .catch(() => undefined);
      return;
    }

    if (hadQueueSelectionRef.current) {
      hadQueueSelectionRef.current = false;
      form.validateFields(["nodeUnitCount"]).catch(() => undefined);
    }
  }, [activeResourceTab, form, queueTotalUnits, selectedQueueNodes, selectedQueueOption]);

  const frameworkItems = frameworkOptions.map((value) => ({
    label: t(p(`frameworkOptions.${value}` as const)),
    value,
  }));

  return (
    <SectionCard title={<SectionTitle>{t(p("title"))}</SectionTitle>}>
      <Form form={form} colon={false} requiredMark={false} initialValues={{ queue: activeResourceTab }}>
        <InlineFormItem name="account" label={<Label>{t(p("accountLabel"))}</Label>} rules={[{ required: true }]}>
          <RoundedSelect
            size="large"
            options={accountOptions}
            placeholder={t(p("accountPlaceholder"))}
            onChange={(value) => {
              markAccountTouched();
              form.setFieldValue("account", value);
            }}
          />
        </InlineFormItem>

        <InlineFormItem name="cluster" label={<Label>{t(p("clusterLabel"))}</Label>} rules={[{ required: true }]}>
          <Space wrap>
            {clusterOptions.map(({ id, name, disabled }) => {
              const button = (
                <ClusterButton
                  size="large"
                  key={id}
                  type={selectedCluster === id ? "primary" : "default"}
                  $selected={selectedCluster === id}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) {
                      return;
                    }
                    markClusterTouched();
                    form.setFieldValue("cluster", id);
                  }}
                >
                  {name}
                </ClusterButton>
              );

              if (!disabled) {
                return button;
              }

              return (
                <Tooltip key={id} title={t(p("clusterUnauthorizedTooltip"))}>
                  <span>{button}</span>
                </Tooltip>
              );
            })}
          </Space>
        </InlineFormItem>

        <InlineFormItem name="queue" label={<Label>{t(p("queueLabel"))}</Label>} rules={[{ required: true }]}>
          <StyledTabs activeKey={activeResourceTab} onChange={handleTabChange} type="line" items={[gpuTab, cpuTab]} />
        </InlineFormItem>

        <InlineFormItem name="priority" label={<Label>{t(p("priorityLabel"))}</Label>} rules={[{ required: true }]}>
          <RoundedSelect
            size="large"
            options={qosOptions.map((qos) => ({ label: qos, value: qos }))}
            placeholder={t(p("priorityPlaceholder"))}
            disabled={!qosOptions.length}
            style={{ width: "520px" }}
          />
        </InlineFormItem>

        <InlineFormItem
          name="framework"
          label={<Label>{t(p("framework.label"))}</Label>}
          helpTip={t(p("framework.helpTip"))}
          rules={[{ required: true }]}
          style={{ marginBottom: 16 }}
        >
          <FrameworkSegmentedControl
            block
            size="large"
            options={frameworkItems}
            value={frameworkValue}
            onChange={(value) => form.setFieldValue("framework", value as TrainFramework)}
          />
        </InlineFormItem>

        {isTensorflow ? (
          <>
            <InlineFormItem
              name="psNodeCount"
              dependencies={["workerNodeCount", "nodeUnitCount"]}
              rules={[
                { type: "number", min: 0 },
                { validator: tensorflowTotalValidator },
                { validator: queueCapacityValidator },
              ]}
              style={{ marginBottom: 8 }}
            >
              <AddonNumberInput
                addonLabel={t(p("frameworkFields.psNodes"))}
                min={0}
                step={1}
                precision={0}
                disabled={inputsDisabled}
              />
            </InlineFormItem>
            <InlineFormItem
              name="workerNodeCount"
              dependencies={["psNodeCount", "nodeUnitCount"]}
              rules={[
                {
                  type: "number",
                  min: 1,
                  message: t(p("frameworkValidation.minWorker")),
                },
                { validator: tensorflowTotalValidator },
                { validator: queueCapacityValidator },
              ]}
              style={{ marginBottom: 8 }}
            >
              <AddonNumberInput
                addonLabel={t(p("frameworkFields.workerNodes"))}
                min={1}
                step={1}
                precision={0}
                disabled={inputsDisabled}
              />
            </InlineFormItem>
          </>
        ) : null}

        {isDistributedFramework ? (
          <InlineFormItem
            name="distributedNodeCount"
            dependencies={["nodeUnitCount"]}
            rules={[
              { validator: requiredNumberValidator(t(p("nodeCountValidation.required"))) },
              {
                type: "number",
                min: 2,
                message: t(p("frameworkValidation.minNodes"), [2]),
              },
              { validator: queueCapacityValidator },
            ]}
            style={{ marginBottom: 8 }}
          >
            <AddonNumberInput
              addonLabel={t(p("frameworkFields.nodeCount"))}
              min={2}
              step={1}
              precision={0}
              disabled={inputsDisabled}
            />
          </InlineFormItem>
        ) : null}

        <InlineFormItem
          name="nodeUnitCount"
          dependencies={["framework", "psNodeCount", "workerNodeCount", "distributedNodeCount"]}
          rules={[
            { validator: requiredNumberValidator(t(p("unitValidation.required"))) },
            {
              type: "number",
              min: 1,
              message: t(p("frameworkValidation.minUnit")),
            },
            { validator: queueCapacityValidator },
          ]}
          style={{ marginBottom: 24 }}
        >
          <AddonNumberInput
            addonLabel={
              activeResourceTab === "gpu" ?
                <span>
                  {unitLabel}
                  <CommonHelpTipWithQuestionMark title={t("app.jobs.appConfigSection.environmentVariables.gpuHelpTip")} />
                </span> :
                unitLabel
            }
            min={1}
            step={1}
            precision={0}
            disabled={inputsDisabled}
            max={nodeUnitMax}
          />
        </InlineFormItem>

        {/* 仅用于传值，页面hidden，无需处理trim逻辑 */}
        <Form.Item name="gpuCores" hidden>
          <input type="hidden" />
        </Form.Item>
        <Form.Item name="cpuCores" hidden>
          <input type="hidden" />
        </Form.Item>

        <InlineFormItem
          label={<Label>{t(p("maxRunTimeLabel"))}</Label>}
          name="maxTime"
          rules={[
            { required: true, message: t(p("maxRunTimeRequired")) },
            {
              validator: validateConfigMaxJobRunningHours(
                t(p("maxRunTimeExceed"), [maxJobRunningTimeHours?.toString() ?? ""]),
                t(p("maxRunTimePositive")),
                maxTimeUnit,
                maxJobRunningTimeHours,
              ),
            },
          ]}
        >
          <RoundedInputNumberWithAddonAfter
            size="large"
            min={1}
            step={1}
            style={{ width: "calc(520px - 72px)", minWidth: "130px" }}
            addonAfter={
              <AddonAfterSelect
                style={{ minWidth: "72px" }}
                value={maxTimeUnit}
                onChange={(value) => onMaxTimeUnitChange(value as MaxTimeUnit)}
              >
                <Select.Option value="min">{t(p("durationUnits.minute"))}</Select.Option>
                <Select.Option value="hour">{t(p("durationUnits.hour"))}</Select.Option>
                <Select.Option value="day">{t(p("durationUnits.day"))}</Select.Option>
              </AddonAfterSelect>
            }
          />
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
