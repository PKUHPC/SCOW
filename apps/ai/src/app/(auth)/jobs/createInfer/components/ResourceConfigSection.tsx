import type { ColumnsType } from "antd/es/table";

import { MaxTimeSelector } from "@scow/lib-web/build/components/job/MaxTimeSelector";
import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { PresetNumberSelector } from "@scow/lib-web/build/components/styledAntdCom/SegmentedButtons";
import { StyledTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { StyledTabs } from "@scow/lib-web/build/components/styledAntdCom/Tabs";
import { SectionCard, SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { validateConfigMaxJobRunningHours } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance, Space } from "antd";
import { useEffect, useMemo, useRef } from "react";
import { type ClusterNodesInfo, getMaxPodsByNodes, getQueueNodes } from "src/app/(auth)/jobs/common";
import { InferInlineFormItem as InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { useQueueTabSelection } from "src/app/(auth)/jobs/hooks/useQueueTabSelection";
import { MAX_TIME_PRESETS, MAX_TIME_UNITS } from "src/app/(auth)/jobs/maxTime";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { styled } from "styled-components";

import type {
  CPUQueueRow,
  GPUQueueRow,
  MaxTimeUnit,
  QueueKind,
  QueueRow,
  ResourceFormValues,
} from "../LaunchInferForm.types";

const p = prefix("app.jobs.resourceConfigSection.");

const ResourceOptionButton = styled(RoundedButton)`
  border-radius: 4px !important;
`;

interface Option {
  label: string;
  value: string;
  disabled?: boolean;
  disabledReason?: string;
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
  selectedPresetUnit?: MaxTimeUnit;
  onSelectedPresetUnitChange: (unit: MaxTimeUnit | undefined) => void;
  maxJobRunningTimeHours?: number;
  gpuUnitLimit?: number;
  isResubmit?: boolean;
}

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
  selectedPresetUnit,
  onSelectedPresetUnitChange,
  maxJobRunningTimeHours,
  gpuUnitLimit,
  isResubmit,
}: ResourceConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const selectedAccount = Form.useWatch<string | undefined>("account", form);
  const selectedQos = Form.useWatch<string | undefined>("priority", form);
  const effectiveMaxTimeUnit = selectedPresetUnit ?? maxTimeUnit;
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

  const perNodeFieldName = activeResourceTab === "gpu" ? "gpuCores" : "cpuCores";
  const inputsDisabled = !selectedQueueOption;
  const selectedPerNodeUnits = Form.useWatch<number | undefined>(perNodeFieldName, form);
  const isMaxTimeUnlimited = Form.useWatch<boolean>("maxTimeUnlimited", form) ?? false;
  const hasInferMaxTimeLimit = maxJobRunningTimeHours !== undefined;
  const isMaxTimeLimited = hasInferMaxTimeLimit || !isMaxTimeUnlimited;
  const queueTotalUnits = selectedQueueOption?.totalUnits ?? 0;
  const queueTotalNodes = selectedQueueOption?.totalNodes ?? 1;
  const perNodeUnitLimit = queueTotalUnits > 0 && queueTotalNodes > 0 ? queueTotalUnits / queueTotalNodes : undefined;
  const perPodLimit = activeResourceTab === "gpu" && gpuUnitLimit && gpuUnitLimit > 0 ? gpuUnitLimit : undefined;
  const gpuInputLimit = (() => {
    if (activeResourceTab !== "gpu") {
      return undefined;
    }
    const limits: number[] = [];
    if (queueTotalUnits > 0) {
      limits.push(queueTotalUnits);
    }
    if (perNodeUnitLimit) {
      limits.push(perNodeUnitLimit);
    }
    if (perPodLimit) {
      limits.push(perPodLimit);
    }
    return limits.length ? Math.min(...limits) : undefined;
  })();

  const selectedQueueNodes = useMemo(
    () => getQueueNodes(queueNodesInfo, selectedQueueOption?.queue),
    [queueNodesInfo, selectedQueueOption],
  );

  const nodeInputLimit = (() => {
    if (!selectedQueueOption || !selectedPerNodeUnits || selectedPerNodeUnits <= 0) {
      return undefined;
    }

    const limits: number[] = [];
    if (queueTotalUnits > 0) {
      limits.push(Math.floor(queueTotalUnits / selectedPerNodeUnits));
    }
    if (selectedQueueNodes.length) {
      const memoryPerUnitMb =
        selectedQueueOption.type === "gpu" ? selectedQueueOption.memoryPerGpuMb : selectedQueueOption.memoryPerCoreMb;
      const { maxPods } = getMaxPodsByNodes({
        nodes: selectedQueueNodes,
        queueType: selectedQueueOption.type,
        perNodeUnits: selectedPerNodeUnits,
        memoryPerUnitMb,
      });
      if (maxPods !== undefined) {
        limits.push(maxPods);
      }
    }

    return limits.length ? Math.min(...limits) : undefined;
  })();

  const cpuInputLimit = (() => {
    if (activeResourceTab !== "cpu") {
      return undefined;
    }
    const limits: number[] = [];
    if (queueTotalUnits > 0) {
      limits.push(queueTotalUnits);
    }
    if (perNodeUnitLimit) {
      limits.push(perNodeUnitLimit);
    }
    return limits.length ? Math.min(...limits) : undefined;
  })();
  const gpuCountLabel = t(p("gpuCountLabel"));
  const cpuCountLabel = t(p("cpuCountLabel"));
  const nodeCountLabel = t(p("nodeCountLabel"));
  const perNodeLabel = activeResourceTab === "gpu" ? gpuCountLabel : cpuCountLabel;
  const handleMaxTimeChange = (value?: number) => {
    form.setFieldValue("maxTimeUnlimited", false);
    form.setFieldValue("maxTime", value);
  };
  const handleMaxTimeUnlimitedSelect = () => {
    form.setFieldsValue({ maxTime: undefined, maxTimeUnlimited: true });
    onSelectedPresetUnitChange(undefined);
  };

  const createUnitLimitValidator = (label: string, limit?: number) => {
    return (_: unknown, value: number) => {
      if (limit === undefined || limit === null || value === undefined || value === null) {
        return Promise.resolve();
      }
      if (Number.isNaN(value)) {
        return Promise.resolve();
      }
      if (value > limit) {
        return Promise.reject(new Error(t(p("unitValidation.limit"), [label, limit.toString()])));
      }
      return Promise.resolve();
    };
  };

  const createTotalCapacityValidator = (target: "node" | "unit") => {
    return (_: unknown, value: number) => {
      if (!selectedQueueOption || queueTotalUnits <= 0 || value === undefined || value === null) {
        return Promise.resolve();
      }
      const nodeValue = target === "node" ? value : Number(form.getFieldValue("nodeCount"));
      const unitValue = target === "unit" ? value : Number(form.getFieldValue(perNodeFieldName));
      if (!nodeValue || !unitValue || Number.isNaN(nodeValue) || Number.isNaN(unitValue)) {
        return Promise.resolve();
      }

      if (selectedQueueNodes.length) {
        const memoryPerUnitMb =
          selectedQueueOption.type === "gpu" ? selectedQueueOption.memoryPerGpuMb : selectedQueueOption.memoryPerCoreMb;
        const { maxPods } = getMaxPodsByNodes({
          nodes: selectedQueueNodes,
          queueType: selectedQueueOption.type,
          perNodeUnits: unitValue,
          memoryPerUnitMb,
        });

        if (maxPods !== undefined && nodeValue > maxPods) {
          return Promise.reject(
            new Error(t(p("frameworkValidation.nodeLimit"), [perNodeLabel, unitValue.toString(), maxPods.toString()])),
          );
        }
      }

      if (nodeValue * unitValue > queueTotalUnits) {
        return Promise.reject(
          new Error(t(p("nodeCountValidation.limit"), [nodeCountLabel, perNodeLabel, queueTotalUnits.toString()])),
        );
      }
      return Promise.resolve();
    };
  };

  const hadQueueSelectionRef = useRef(false);

  useEffect(() => {
    if (selectedQueueOption) {
      hadQueueSelectionRef.current = true;
      const fieldName = activeResourceTab === "gpu" ? "gpuCores" : "cpuCores";
      form.validateFields([fieldName, "nodeCount"], { validateOnly: true }).catch(() => undefined);
      return;
    }

    if (hadQueueSelectionRef.current) {
      hadQueueSelectionRef.current = false;
      form.validateFields(["gpuCores", "cpuCores", "nodeCount"], { validateOnly: true }).catch(() => undefined);
    }
  }, [activeResourceTab, form, queueTotalUnits, selectedQueueNodes, selectedQueueOption]);

  return (
    <SectionCard bordered={false} title={<SectionTitle>{t(p("title"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
        initialValues={{ queue: activeResourceTab, nodeCount: 1, maxTimeUnlimited: false }}
      >
        <InlineFormItem name="account" label={<Label>{t(p("accountLabel"))}</Label>} rules={[{ required: true }]}>
          <Space wrap>
            {accountOptions.map(({ label, value, disabled, disabledReason }) => {
              const button = (
                <ResourceOptionButton
                  size="large"
                  key={value}
                  type={selectedAccount === value ? "primary" : "default"}
                  $selected={selectedAccount === value}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    markAccountTouched();
                    form.setFieldValue("account", value);
                  }}
                >
                  {label}
                </ResourceOptionButton>
              );

              return disabled && disabledReason ? (
                <Tooltip key={value} title={disabledReason}>
                  <span>{button}</span>
                </Tooltip>
              ) : (
                button
              );
            })}
          </Space>
        </InlineFormItem>

        <InlineFormItem name="cluster" label={<Label>{t(p("clusterLabel"))}</Label>} rules={[{ required: true }]}>
          <Space wrap>
            {clusterOptions.map(({ id, name, disabled }) => {
              const button = (
                <ResourceOptionButton
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
                </ResourceOptionButton>
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
          <Space wrap>
            {qosOptions.length ? (
              qosOptions.map((qos) => (
                <ResourceOptionButton
                  size="large"
                  key={qos}
                  type={selectedQos === qos ? "primary" : "default"}
                  $selected={selectedQos === qos}
                  onClick={() => form.setFieldValue("priority", qos)}
                >
                  {qos}
                </ResourceOptionButton>
              ))
            ) : (
              <ResourceOptionButton size="large" disabled>
                {t(p("priorityPlaceholder"))}
              </ResourceOptionButton>
            )}
          </Space>
        </InlineFormItem>

        <InlineFormItem
          name="nodeCount"
          label={<Label>{nodeCountLabel}</Label>}
          helpTip={t(p("nodeCountHelp"))}
          dependencies={[perNodeFieldName]}
          rules={[
            { required: true, message: t(p("nodeCountValidation.required")) },
            {
              type: "number",
              min: 1,
              message: t(p("nodeCountValidation.min")),
            },
            { validator: createTotalCapacityValidator("node") },
          ]}
        >
          <PresetNumberSelector
            max={nodeInputLimit}
            disabled={inputsDisabled}
            placeholder={t(p("otherValuePlaceholder"))}
            disabledTooltip={t(p("presetDisabledTooltip"))}
          />
        </InlineFormItem>

        {activeResourceTab === "gpu" ? (
          <InlineFormItem
            name="gpuCores"
            label={<Label>{gpuCountLabel}</Label>}
            helpTip={t("app.jobs.appConfigSection.environmentVariables.gpuHelpTip")}
            dependencies={["nodeCount"]}
            rules={[
              { required: true, message: t(p("unitValidation.required")) },
              {
                type: "number",
                min: 1,
                message: t(p("unitValidation.min")),
              },
              { validator: createUnitLimitValidator(gpuCountLabel, gpuInputLimit) },
              { validator: createTotalCapacityValidator("unit") },
            ]}
          >
            <PresetNumberSelector
              max={gpuInputLimit}
              disabled={inputsDisabled}
              placeholder={t(p("otherValuePlaceholder"))}
              disabledTooltip={t(p("presetDisabledTooltip"))}
            />
          </InlineFormItem>
        ) : null}

        {activeResourceTab === "cpu" ? (
          <InlineFormItem
            name="cpuCores"
            label={<Label>{cpuCountLabel}</Label>}
            dependencies={["nodeCount"]}
            rules={[
              { required: true, message: t(p("unitValidation.required")) },
              {
                type: "number",
                min: 1,
                message: t(p("unitValidation.min")),
              },
              { validator: createUnitLimitValidator(cpuCountLabel, cpuInputLimit) },
              { validator: createTotalCapacityValidator("unit") },
            ]}
          >
            <PresetNumberSelector
              max={cpuInputLimit}
              disabled={inputsDisabled}
              placeholder={t(p("otherValuePlaceholder"))}
              disabledTooltip={t(p("presetDisabledTooltip"))}
            />
          </InlineFormItem>
        ) : null}

        <InlineFormItem
          label={<Label>{t(p("maxRunTimeLabel"))}</Label>}
          rules={[{ required: true, message: t(p("maxRunTimeRequired")) }]}
          helpTip={t(p("maxRunTimeHelp"))}
        >
          <div style={{ width: "720px" }}>
            <Form.Item name="maxTimeUnlimited" noStyle>
              <input type="hidden" />
            </Form.Item>
            <Form.Item
              name="maxTime"
              style={{ marginBottom: 0 }}
              rules={
                isMaxTimeLimited
                  ? [
                      { required: true, message: t(p("maxRunTimeRequired")) },
                      {
                        validator: validateConfigMaxJobRunningHours(
                          t(p("maxRunTimeExceed"), [maxJobRunningTimeHours?.toString() ?? ""]),
                          t(p("maxRunTimePositive")),
                          effectiveMaxTimeUnit,
                          maxJobRunningTimeHours,
                        ),
                      },
                    ]
                  : []
              }
            >
              <MaxTimeSelector
                disabled={!selectedQueueOption}
                maxRunningTimeHours={maxJobRunningTimeHours}
                disabledTooltip={t(p("maxRunTimeExceed"), [maxJobRunningTimeHours?.toString() ?? ""])}
                maxTimeUnit={maxTimeUnit}
                onMaxTimeUnitChange={onMaxTimeUnitChange}
                selectedPresetUnit={selectedPresetUnit}
                onSelectedPresetUnitChange={onSelectedPresetUnitChange}
                onChange={handleMaxTimeChange}
                labels={{
                  minutes: t(p("durationUnits.minute")),
                  hours: t(p("durationUnits.hour")),
                  days: t(p("durationUnits.day")),
                  otherValue: t(p("otherValuePlaceholder")),
                }}
                units={MAX_TIME_UNITS}
                presets={MAX_TIME_PRESETS}
                lastPresetReplacement={
                  hasInferMaxTimeLimit
                    ? undefined
                    : {
                        key: "unlimited",
                        label: t(p("maxRunTimeUnlimitedLabel")),
                        selected: isMaxTimeUnlimited,
                        onSelect: handleMaxTimeUnlimitedSelect,
                      }
                }
              />
            </Form.Item>
          </div>
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
