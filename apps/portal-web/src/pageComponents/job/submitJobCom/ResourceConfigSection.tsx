import type { ColumnsType } from "antd/es/table";

import {
  createMaxTimePresets,
  MaxTimeSelector,
  type MaxTimeUnits,
} from "@scow/lib-web/build/components/job/MaxTimeSelector";
import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { InlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { PresetNumberSelector } from "@scow/lib-web/build/components/styledAntdCom/SegmentedButtons";
import { StyledTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { StyledTabs } from "@scow/lib-web/build/components/styledAntdCom/Tabs";
import { SectionTitle, TitledSectionCard } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { validateConfigMaxJobRunningHours } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance, Space } from "antd";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TimeUnit } from "src/models/job";

import { ResourceFormValues } from "./SubmitJobForm.types";

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

export type PartitionTabKey = "cpu" | "gpu";
const PARTITION_TABLE_SCROLL_Y = 325;
const PARTITION_TABLE_MAX_VISIBLE_ROWS = 5;

export interface PartitionRow {
  key: string;
  name: string;
  description: string;
  nodeSpecLines: ReactNode[];
  disabled: boolean;
  idleNodes: string;
  idleCpu: string;
  idleGpu: string;
  pendingJobs: string | number;
  kind: PartitionTabKey;
}

interface ResourceConfigSectionProps {
  form: FormInstance<ResourceFormValues>;
  accountOptions: Option[];
  accountLoading?: boolean;
  clusterOptions: ClusterOption[];
  selectedCluster?: string;
  selectedAccount?: string;
  partitionRows: PartitionRow[];
  activePartitionTab: PartitionTabKey;
  onActivePartitionTabChange: (tab: PartitionTabKey) => void;
  selectedPartitionKey?: string;
  onPartitionSelect: (partitionName: string | undefined) => void;
  qosOptions: string[];
  nodeCountLimit?: number;
  unitCountLimit?: number;
  inputsDisabled?: boolean;
  maxTimeUnit: TimeUnit;
  onMaxTimeUnitChange: (unit: TimeUnit) => void;
  maxRunningTimeHours?: number;
  selectedPresetUnit?: TimeUnit;
  onSelectedPresetUnitChange: (unit: TimeUnit | undefined) => void;
  selectorResetKey?: number;
}

const p = prefix("pageComp.submitJobCom.ResourceConfigSection.");
const PARTITION_TABLE_SELECTION_WIDTH = 48;

const MAX_TIME_UNITS: MaxTimeUnits<TimeUnit> = {
  minutes: TimeUnit.MINUTES,
  hours: TimeUnit.HOURS,
  days: TimeUnit.DAYS,
};

export const MAX_TIME_PRESETS = createMaxTimePresets(MAX_TIME_UNITS);

export const ResourceConfigSection = ({
  form,
  accountOptions,
  accountLoading,
  clusterOptions,
  selectedCluster,
  selectedAccount,
  partitionRows,
  activePartitionTab,
  onActivePartitionTabChange,
  selectedPartitionKey,
  onPartitionSelect,
  qosOptions,
  nodeCountLimit,
  unitCountLimit,
  inputsDisabled,
  maxTimeUnit,
  onMaxTimeUnitChange,
  selectedPresetUnit,
  onSelectedPresetUnitChange,
  maxRunningTimeHours,
  selectorResetKey,
}: ResourceConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const effectiveMaxTimeUnit = selectedPresetUnit ?? maxTimeUnit;

  const queueTouchedRef = useRef(false);
  const sortPartitionRows = (a: PartitionRow, b: PartitionRow) => {
    if (a.disabled !== b.disabled) {
      return a.disabled ? 1 : -1;
    }
    return a.key.localeCompare(b.key);
  };
  const baseColumns: ColumnsType<PartitionRow> = [
    { title: t(p("tablePartition")), dataIndex: "name", key: "name", width: "14%" },
    {
      title: t(p("tablePartitionDescription")),
      dataIndex: "description",
      key: "description",
      width: "36%",
      render: (description: string) => (
        <div>
          {description.split(";").map((line, index) => (
            <div key={`${index}-${line.trim()}`}>{line.trim()}</div>
          ))}
        </div>
      ),
    },
    {
      title: t(p("tableNodeSpec")),
      dataIndex: "nodeSpecLines",
      key: "nodeSpecLines",
      width: "14%",
      render: (lines: ReactNode[]) => (
        <div>
          {lines?.map((line, index) => (
            <div key={`${index}-${String(line)}`}>{line}</div>
          ))}
        </div>
      ),
    },
    { title: t(p("tableIdleNodes")), dataIndex: "idleNodes", key: "idleNodes", width: "12%" },
    { title: t(p("tablePendingJobs")), dataIndex: "pendingJobs", key: "pendingJobs", width: "12%" },
  ];
  const cpuColumns: ColumnsType<PartitionRow> = [
    ...baseColumns.slice(0, 4),
    { title: t(p("tableIdleCpu")), dataIndex: "idleCpu", key: "idleCpu", width: "12%" },
    ...baseColumns.slice(4),
  ];
  const gpuColumns: ColumnsType<PartitionRow> = [
    ...baseColumns.slice(0, 4),
    { title: t(p("tableIdleGpu")), dataIndex: "idleGpu", key: "idleGpu", width: "12%" },
    ...baseColumns.slice(4),
  ];

  const gpuRows = useMemo(() => partitionRows.filter((row) => row.kind === "gpu"), [partitionRows]);
  const cpuRows = useMemo(() => partitionRows.filter((row) => row.kind === "cpu"), [partitionRows]);
  const sortedGpuRows = useMemo(() => [...gpuRows].sort(sortPartitionRows), [gpuRows]);
  const sortedCpuRows = useMemo(() => [...cpuRows].sort(sortPartitionRows), [cpuRows]);
  const selectedQos = Form.useWatch<string | undefined>("qos", form);

  const selectedKeyInTab = (rows: PartitionRow[]) =>
    selectedPartitionKey && rows.some((row) => row.key === selectedPartitionKey) ? [selectedPartitionKey] : [];
  const getTableScroll = (rows: PartitionRow[]) =>
    rows.length > PARTITION_TABLE_MAX_VISIBLE_ROWS ? { y: PARTITION_TABLE_SCROLL_Y } : undefined;

  useEffect(() => {
    if (!selectedPartitionKey || form.getFieldError("partition").length === 0) {
      return;
    }
    form.validateFields(["partition"]).catch(() => undefined);
  }, [form, selectedPartitionKey]);

  useEffect(() => {
    if (!selectedQos || form.getFieldError("qos").length === 0) {
      return;
    }
    form.validateFields(["qos"]).catch(() => undefined);
  }, [form, selectedQos]);

  const cpuTab = {
    key: "cpu",
    label: t(p("cpuTabLabel")),
    children: (
      <StyledTable
        bordered
        size="small"
        pagination={false}
        tableLayout="fixed"
        rowKey="key"
        columns={cpuColumns}
        dataSource={sortedCpuRows}
        scroll={getTableScroll(sortedCpuRows)}
        rowSelection={{
          type: "radio",
          columnWidth: PARTITION_TABLE_SELECTION_WIDTH,
          selectedRowKeys: activePartitionTab === "cpu" ? selectedKeyInTab(sortedCpuRows) : [],
          onChange: (keys) => onPartitionSelect(keys[0] as string),
        }}
        rowClassName={(record) => (record.key === selectedPartitionKey ? "selected-row" : "")}
      />
    ),
  };

  const gpuTab = {
    key: "gpu",
    label: t(p("gpuTabLabel")),
    children: (
      <StyledTable
        bordered
        size="small"
        pagination={false}
        tableLayout="fixed"
        rowKey="key"
        columns={gpuColumns}
        dataSource={sortedGpuRows}
        scroll={getTableScroll(sortedGpuRows)}
        rowSelection={{
          type: "radio",
          columnWidth: PARTITION_TABLE_SELECTION_WIDTH,
          selectedRowKeys: activePartitionTab === "gpu" ? selectedKeyInTab(sortedGpuRows) : [],
          onChange: (keys) => onPartitionSelect(keys[0] as string),
        }}
        rowClassName={(record) => (record.key === selectedPartitionKey ? "selected-row" : "")}
      />
    ),
  };

  useEffect(() => {
    queueTouchedRef.current = false;
  }, [partitionRows]);

  useEffect(() => {
    if (inputsDisabled) {
      return;
    }

    // 分区切换会更新节点/单节点资源上限，这里主动重跑已触发字段的校验，避免保留旧分区的错误提示。
    const unitField: "gpuCores" | "cpuCores" = activePartitionTab === "gpu" ? "gpuCores" : "cpuCores";
    const fieldsToValidate: ("nodeCount" | "gpuCores" | "cpuCores")[] = [];

    if (form.isFieldTouched("nodeCount") || form.getFieldError("nodeCount").length > 0) {
      fieldsToValidate.push("nodeCount");
    }
    if (form.isFieldTouched(unitField) || form.getFieldError(unitField).length > 0) {
      fieldsToValidate.push(unitField);
    }
    if (fieldsToValidate.length === 0) {
      return;
    }

    form.setFields(fieldsToValidate.map((name) => ({ name, errors: [] })));
    form.validateFields(fieldsToValidate).catch(() => undefined);
  }, [activePartitionTab, form, inputsDisabled, nodeCountLimit, unitCountLimit]);

  // 队列变化时优先保持当前 tab，只有当前 tab 无可选分区时才切换，避免切换集群时 tab 抖动
  useEffect(() => {
    const optionsByTab: Record<PartitionTabKey, PartitionRow[]> = {
      cpu: sortedCpuRows,
      gpu: sortedGpuRows,
    };

    const hasAnyOptions = sortedCpuRows.length > 0 || sortedGpuRows.length > 0;
    if (!hasAnyOptions) {
      onPartitionSelect(undefined);
      return;
    }

    // 用户手动切过队列 tab 后，不再用自动逻辑覆盖其选择
    if (queueTouchedRef.current) {
      return;
    }

    const activeTabOptions = optionsByTab[activePartitionTab];
    let nextTab: PartitionTabKey = activePartitionTab;

    // 当前 tab 无可选分区时再切换
    if (!activeTabOptions.length) {
      nextTab = sortedCpuRows.length > 0 ? "cpu" : "gpu";
    }

    if (activePartitionTab !== nextTab) {
      onActivePartitionTabChange(nextTab);
    }

    const options = optionsByTab[nextTab];
    const hasValidSelection = options.some((option) => option.key === selectedPartitionKey);
    if (!hasValidSelection) {
      onPartitionSelect(options[0]?.key);
    }
  }, [
    activePartitionTab,
    onActivePartitionTabChange,
    onPartitionSelect,
    selectedPartitionKey,
    sortedCpuRows,
    sortedGpuRows,
  ]);

  return (
    <TitledSectionCard title={<SectionTitle>{t(p("sectionTitle"))}</SectionTitle>}>
      <Form form={form} colon={false} requiredMark={false} initialValues={{}}>
        <InlineFormItem
          name="account"
          label={<FormLabel>{t(p("accountLabel"))}</FormLabel>}
          rules={[{ required: true }]}
        >
          <Space wrap>
            {accountOptions.map(({ label, value, disabled, disabledReason }) => {
              const button = (
                <RoundedButton
                  size="large"
                  key={value}
                  type={selectedAccount === value ? "primary" : "default"}
                  $selected={selectedAccount === value}
                  disabled={accountLoading || disabled}
                  loading={accountLoading}
                  onClick={() => {
                    if (accountLoading || disabled) {
                      return;
                    }
                    form.setFieldValue("account", value);
                  }}
                >
                  {label}
                </RoundedButton>
              );

              if (!disabled || !disabledReason) {
                return button;
              }

              return (
                <Tooltip key={value} title={disabledReason} arrow={false} align={{ offset: [0, -12] }}>
                  <span>{button}</span>
                </Tooltip>
              );
            })}
          </Space>
        </InlineFormItem>

        <InlineFormItem
          name="cluster"
          label={<FormLabel>{t(p("clusterLabel"))}</FormLabel>}
          rules={[{ required: true }]}
        >
          <Space wrap>
            {clusterOptions.map(({ id, name, disabled }) => {
              const button = (
                <RoundedButton
                  size="large"
                  key={id}
                  type={selectedCluster === id ? "primary" : "default"}
                  $selected={selectedCluster === id}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) {
                      return;
                    }
                    form.setFieldValue("cluster", id);
                  }}
                >
                  {name}
                </RoundedButton>
              );

              if (!disabled) {
                return button;
              }

              return (
                <Tooltip key={id} title={t(p("clusterUnauthorized"))} arrow={false} align={{ offset: [0, -12] }}>
                  <span>{button}</span>
                </Tooltip>
              );
            })}
          </Space>
        </InlineFormItem>

        <InlineFormItem
          name="partition"
          label={<FormLabel>{t(p("partitionLabel"))}</FormLabel>}
          rules={[{ required: true }]}
        >
          <StyledTabs
            activeKey={activePartitionTab}
            onChange={(key) => {
              const nextTab = key as PartitionTabKey;
              queueTouchedRef.current = true;
              onActivePartitionTabChange(nextTab);

              const nextOptions = nextTab === "gpu" ? sortedGpuRows : sortedCpuRows;
              const hasValidSelection = nextOptions.some((option) => option.key === selectedPartitionKey);
              if (!hasValidSelection) {
                onPartitionSelect(nextOptions[0]?.key);
              }
            }}
            type="line"
            items={[cpuTab, gpuTab]}
          />
        </InlineFormItem>

        <InlineFormItem name="qos" label={<FormLabel>{t(p("qosLabel"))}</FormLabel>} rules={[{ required: true }]}>
          <Space wrap>
            {qosOptions.length ? (
              qosOptions.map((qos) => (
                <RoundedButton
                  size="large"
                  key={qos}
                  type={selectedQos === qos ? "primary" : "default"}
                  $selected={selectedQos === qos}
                  onClick={() => form.setFieldValue("qos", qos)}
                >
                  {qos}
                </RoundedButton>
              ))
            ) : (
              <RoundedButton size="large" disabled>
                {t(p("qosEmptyPlaceholder"))}
              </RoundedButton>
            )}
          </Space>
        </InlineFormItem>
        <InlineFormItem
          name="nodeCount"
          label={<FormLabel>{t(p("nodeCountLabel"))}</FormLabel>}
          rules={[
            { required: true, message: t(p("nodeCountRequired")) },
            { type: "number" as const, min: 1 },
            ...(nodeCountLimit ? [{ type: "number" as const, max: nodeCountLimit }] : []),
          ]}
        >
          <PresetNumberSelector
            key={`nodeCount-${selectorResetKey ?? 0}`}
            disabled={inputsDisabled}
            max={nodeCountLimit}
            placeholder={t(p("nodeCountOtherPlaceholder"))}
            disabledTooltip={t(p("nodeCountExceedsMaxTooltip"))}
          />
        </InlineFormItem>

        {activePartitionTab === "gpu" ? (
          <InlineFormItem
            name="gpuCores"
            label={<FormLabel>{t(p("gpuCoresLabel"))}</FormLabel>}
            rules={[
              { required: true, message: t(p("gpuCoresRequired")) },
              { type: "number" as const, min: 1 },
              ...(unitCountLimit ? [{ type: "number" as const, max: unitCountLimit }] : []),
            ]}
          >
            <PresetNumberSelector
              key={`gpuCores-${selectorResetKey ?? 0}`}
              disabled={inputsDisabled}
              max={unitCountLimit}
              placeholder={t(p("nodeCountOtherPlaceholder"))}
              disabledTooltip={t(p("nodeCountExceedsMaxTooltip"))}
            />
          </InlineFormItem>
        ) : null}

        {activePartitionTab === "cpu" ? (
          <InlineFormItem
            name="cpuCores"
            label={<FormLabel>{t(p("cpuCoresLabel"))}</FormLabel>}
            rules={[
              { required: true, message: t(p("cpuCoresRequired")) },
              { type: "number" as const, min: 1 },
              ...(unitCountLimit ? [{ type: "number" as const, max: unitCountLimit }] : []),
            ]}
          >
            <PresetNumberSelector
              key={`cpuCores-${selectorResetKey ?? 0}`}
              disabled={inputsDisabled}
              max={unitCountLimit}
              placeholder={t(p("nodeCountOtherPlaceholder"))}
              disabledTooltip={t(p("nodeCountExceedsMaxTooltip"))}
            />
          </InlineFormItem>
        ) : null}

        <InlineFormItem
          name="maxTime"
          label={<FormLabel>{t(p("maxTimeLabel"))}</FormLabel>}
          rules={[
            { required: true, message: t(p("maxTimeRequired")) },
            {
              validator: validateConfigMaxJobRunningHours(
                t(p("maxRunTimeExceed"), [maxRunningTimeHours?.toString() ?? ""]),
                t(p("maxTimePositive")),
                effectiveMaxTimeUnit,
                maxRunningTimeHours,
              ),
            },
          ]}
        >
          <MaxTimeSelector
            key={`maxTime-${selectorResetKey ?? 0}`}
            disabled={inputsDisabled}
            maxRunningTimeHours={maxRunningTimeHours}
            disabledTooltip={t(p("maxRunTimeExceed"), [maxRunningTimeHours?.toString() ?? ""])}
            maxTimeUnit={maxTimeUnit}
            onMaxTimeUnitChange={onMaxTimeUnitChange}
            selectedPresetUnit={selectedPresetUnit}
            onSelectedPresetUnitChange={onSelectedPresetUnitChange}
            labels={{
              minutes: t(p("minutes")),
              hours: t(p("hours")),
              days: t(p("days")),
              otherValue: t(p("nodeCountOtherPlaceholder")),
            }}
            units={MAX_TIME_UNITS}
            presets={MAX_TIME_PRESETS}
          />
        </InlineFormItem>
      </Form>
    </TitledSectionCard>
  );
};
