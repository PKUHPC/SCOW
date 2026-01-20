import { Form, type FormInstance, Select, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef } from "react";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useTheme } from "styled-components";

import {
  ClusterButton,
  Label,
  RoundedAfterInputNumber,
  RoundedInputNumber,
  RoundedSelect,
  SectionCard,
  SectionTitle,
  StyledTable,
  StyledTabs,
} from "../LaunchDevForm.styles";
import type {
  CPUQueueRow,
  GPUQueueRow,
  MaxTimeUnit,
  QueueKind,
  QueueRow,
  ResourceFormValues,
} from "../LaunchDevForm.types";

const p = prefix("app.jobs.resourceConfigSection.");

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
  maxJobRunningTimeHours?: number;
  convertDurationToHours: (value: number, unit: MaxTimeUnit) => number;
  gpuUnitLimit?: number;
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
  maxJobRunningTimeHours,
  convertDurationToHours,
  gpuUnitLimit,
}: ResourceConfigSectionProps) => {
  const theme = useTheme();
  const t = useI18nTranslateToString();

  const sortedGpuRows = useMemo(
    () => [...gpuRows].sort((a, b) => (a.disabled === b.disabled ? 0 : a.disabled ? 1 : -1)),
    [gpuRows],
  );

  const sortedCpuRows = useMemo(
    () => [...cpuRows].sort((a, b) => (a.disabled === b.disabled ? 0 : a.disabled ? 1 : -1)),
    [cpuRows],
  );

  const handleTabChange = (key: string) => {
    const tabKey = key as QueueKind;
    onActiveResourceTabChange(tabKey);
    form.setFieldValue("queue", tabKey);

    const options = tabKey === "gpu" ? sortedGpuRows : sortedCpuRows;
    if (!options.length) {
      onQueueSelect(undefined);
      return;
    }

    const hasValidSelection = options.some((option) => option.id === selectedQueueKey);
    if (!hasValidSelection) {
      const firstOption = options[0]?.id;
      onQueueSelect(firstOption);
    }
  };

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
        rowClassName={(record) =>
          activeResourceTab === "cpu" && record.id === selectedQueueKey ? "selected-row" : ""}
      />
    ),
  };

  const inputsDisabled = !selectedQueueOption;
  const queueTotalUnits = selectedQueueOption?.totalUnits ?? 0;
  const queueTotalNodes = selectedQueueOption?.totalNodes ?? 1;
  const perNodeUnitLimit = queueTotalUnits > 0 && queueTotalNodes > 0
    ? queueTotalUnits / queueTotalNodes
    : undefined;
  const perPodLimit = activeResourceTab === "gpu" && gpuUnitLimit && gpuUnitLimit > 0
    ? gpuUnitLimit
    : undefined;
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
        return Promise.reject(
          new Error(
            t(p("unitValidation.limit"), [
              label,
              limit.toString(),
            ]),
          ),
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
      form.validateFields([fieldName], { validateOnly: true }).catch(() => undefined);
      return;
    }

    if (hadQueueSelectionRef.current) {
      hadQueueSelectionRef.current = false;
      form.validateFields(["gpuCores", "cpuCores"], { validateOnly: true }).catch(() => undefined);
    }
  }, [activeResourceTab, form, queueTotalUnits, selectedQueueOption]);

  return (
    <SectionCard title={<SectionTitle>{t(p("title"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
        initialValues={{ queue: activeResourceTab }}
      >
        <InlineFormItem
          name="account"
          label={<Label>{t(p("accountLabel"))}</Label>}
          rules={[{ required: true }]}
        >
          <RoundedSelect
            size="large"
            options={accountOptions}
            placeholder={t(p("accountPlaceholder"))}
            onChange={(value) => form.setFieldValue("account", value)}
          />
        </InlineFormItem>

        <InlineFormItem
          name="cluster"
          label={<Label>{t(p("clusterLabel"))}</Label>}
          rules={[{ required: true }]}
        >
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
                    if (disabled) { return; }
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

        <InlineFormItem
          name="queue"
          label={<Label>{t(p("queueLabel"))}</Label>}
          rules={[{ required: true }]}
        >
          <StyledTabs
            activeKey={activeResourceTab}
            onChange={handleTabChange}
            type="line"
            items={[gpuTab, cpuTab]}
          />
        </InlineFormItem>

        <InlineFormItem
          name="priority"
          label={<Label>{t(p("priorityLabel"))}</Label>}
          rules={[{ required: true }]}
        >
          <RoundedSelect
            size="large"
            options={qosOptions.map((qos) => ({ label: qos, value: qos }))}
            placeholder={t(p("priorityPlaceholder"))}
            disabled={!qosOptions.length}
          />
        </InlineFormItem>

        {activeResourceTab === "gpu" ? (
          <InlineFormItem
            name="gpuCores"
            label={<Label>{gpuCountLabel}</Label>}
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
            <RoundedInputNumber
              size="large"
              min={1}
              step={1}
              precision={0}
              style={{ width: "50%" }}
              disabled={inputsDisabled}
              max={gpuInputLimit}
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
            <RoundedInputNumber
              size="large"
              min={1}
              step={1}
              precision={0}
              style={{ width: "50%" }}
              disabled={inputsDisabled}
              max={cpuInputLimit}
            />
          </InlineFormItem>
        ) : null}

        <InlineFormItem
          label={<Label>{t(p("maxRunTimeLabel"))}</Label>}
          name="maxTime"
          rules={[
            { required:true, message: t(p("maxRunTimeRequired")) },
            {
              validator: (_, value) => {
                if (value <= 0) {
                  return Promise.reject(new Error(t(p("maxRunTimePositive"))));
                }
                if (maxJobRunningTimeHours !== undefined) {
                  const timeInHours = convertDurationToHours(value, maxTimeUnit);
                  if (timeInHours > maxJobRunningTimeHours) {
                    return Promise.reject(
                      new Error(t(p("maxRunTimeExceed"), [maxJobRunningTimeHours.toString()])),
                    );
                  }
                }
                return Promise.resolve();
              },
            }]}
        >
          <RoundedAfterInputNumber
            size="large"
            min={1}
            step={1}
            theme={theme}
            style={{ width: "50%", minWidth:"130px" }}
            addonAfter={(
              <RoundedSelect
                $noShadow
                style={{ minWidth: "70px" }}
                value={maxTimeUnit}
                onChange={(value) => onMaxTimeUnitChange(value as MaxTimeUnit)}
              >
                <Select.Option value="min">{t(p("durationUnits.minute"))}</Select.Option>
                <Select.Option value="hour">{t(p("durationUnits.hour"))}</Select.Option>
                <Select.Option value="day">{t(p("durationUnits.day"))}</Select.Option>
              </RoundedSelect>
            )}
          />
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
