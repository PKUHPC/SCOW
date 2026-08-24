import type { ColumnsType } from "antd/es/table";

import { MaxTimeSelector } from "@scow/lib-web/build/components/job/MaxTimeSelector";
import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { PresetNumberSelector } from "@scow/lib-web/build/components/styledAntdCom/SegmentedButtons";
import { StyledTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { StyledTabs } from "@scow/lib-web/build/components/styledAntdCom/Tabs";
import { SectionCard, SectionTitle } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { validateConfigMaxJobRunningHours } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance, Space, Tooltip } from "antd";
import { useEffect, useRef } from "react";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
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
} from "../LaunchDevForm.types";

const p = prefix("app.jobs.resourceConfigSection.");

const ResourceOptionButton = styled(RoundedButton)`
  border-radius: 4px !important;
`;

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
  const { sortedGpuRows, sortedCpuRows, handleTabChange, markAccountTouched, markClusterTouched } = useQueueTabSelection({
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

  const inputsDisabled = !selectedQueueOption;
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
  const gpuCountLabel = t(p("gpuLabel"));
  const cpuCountLabel = t(p("cpuLabel"));

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

  const hadQueueSelectionRef = useRef(false);

  useEffect(() => {
    if (selectedQueueOption) {
      hadQueueSelectionRef.current = true;
      const fieldName = activeResourceTab === "gpu" ? "gpuCores" : "cpuCores";
      form.validateFields([fieldName], { validateOnly: true }).catch(() => undefined);
      return;
    }

    if (hadQueueSelectionRef.current) {
      hadQueueSelectionRef.current = false;
      form.validateFields(["gpuCores", "cpuCores"], { validateOnly: true }).catch(() => undefined);
    }
  }, [activeResourceTab, form, queueTotalUnits, selectedQueueOption]);

  return (
    <SectionCard bordered={false} title={<SectionTitle>{t(p("title"))}</SectionTitle>}>
      <Form form={form} colon={false} requiredMark={false} initialValues={{ queue: activeResourceTab }}>
        <InlineFormItem name="account" label={<Label>{t(p("accountLabel"))}</Label>} rules={[{ required: true }]}>
          <Space wrap>
            {accountOptions.map(({ label, value }) => (
              <ResourceOptionButton
                size="large"
                key={value}
                type={selectedAccount === value ? "primary" : "default"}
                $selected={selectedAccount === value}
                onClick={() => {
                  markAccountTouched();
                  form.setFieldValue("account", value);
                }}
              >
                {label}
              </ResourceOptionButton>
            ))}
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

        {activeResourceTab === "gpu" ? (
          <InlineFormItem
            name="gpuCores"
            label={<Label>{gpuCountLabel}</Label>}
            helpTip={t("app.jobs.appConfigSection.environmentVariables.gpuHelpTip")}
            rules={[
              { required: true, message: t(p("unitValidation.required")) },
              {
                type: "number",
                min: 1,
                message: t(p("unitValidation.min")),
              },
              { validator: createUnitLimitValidator(gpuCountLabel, gpuInputLimit) },
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
            rules={[
              { required: true, message: t(p("unitValidation.required")) },
              {
                type: "number",
                min: 1,
                message: t(p("unitValidation.min")),
              },
              { validator: createUnitLimitValidator(cpuCountLabel, cpuInputLimit) },
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
          name="maxTime"
          rules={[
            { required: true, message: t(p("maxRunTimeRequired")) },
            {
              validator: validateConfigMaxJobRunningHours(
                t(p("maxRunTimeExceed"), [maxJobRunningTimeHours?.toString() ?? ""]),
                t(p("maxRunTimePositive")),
                effectiveMaxTimeUnit,
                maxJobRunningTimeHours,
              ),
            },
          ]}
        >
          <MaxTimeSelector
            disabled={!selectedQueueOption}
            maxRunningTimeHours={maxJobRunningTimeHours}
            disabledTooltip={t(p("maxRunTimeExceed"), [maxJobRunningTimeHours?.toString() ?? ""])}
            maxTimeUnit={maxTimeUnit}
            onMaxTimeUnitChange={onMaxTimeUnitChange}
            selectedPresetUnit={selectedPresetUnit}
            onSelectedPresetUnitChange={onSelectedPresetUnitChange}
            labels={{
              minutes: t(p("durationUnits.minute")),
              hours: t(p("durationUnits.hour")),
              days: t(p("durationUnits.day")),
              otherValue: t(p("otherValuePlaceholder")),
            }}
            units={MAX_TIME_UNITS}
            presets={MAX_TIME_PRESETS}
          />
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
