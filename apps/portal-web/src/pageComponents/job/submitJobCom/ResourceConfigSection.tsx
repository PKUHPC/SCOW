import type { ColumnsType } from "antd/es/table";

import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { InlineFormItem } from "@scow/lib-web/build/components/styledAntdCom/CustomFormItem";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import {
  RoundedInputNumber,
  RoundedInputNumberWithAddonAfter,
} from "@scow/lib-web/build/components/styledAntdCom/Input";
import { AddonAfterSelect } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { StyledTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { StyledTabs } from "@scow/lib-web/build/components/styledAntdCom/Tabs";
import { SectionTitle, TitledSectionCard } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { validateConfigMaxJobRunningHours } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance, Select, Space } from "antd";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TimeUnit } from "src/models/job";

import { ResourceFormValues } from "./SubmitJobForm.types";

interface Option {
  label: string;
  value: string;
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
}

const p = prefix("pageComp.submitJobCom.ResourceConfigSection.");

export const ResourceConfigSection = ({
  form,
  accountOptions,
  accountLoading,
  clusterOptions,
  selectedCluster,
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
  maxRunningTimeHours,
}: ResourceConfigSectionProps) => {
  const t = useI18nTranslateToString();

  const queueTouchedRef = useRef(false);
  const sortPartitionRows = (a: PartitionRow, b: PartitionRow) => {
    if (a.disabled !== b.disabled) {
      return a.disabled ? 1 : -1;
    }
    return a.key.localeCompare(b.key);
  };
  const baseColumns: ColumnsType<PartitionRow> = [
    { title: t(p("tablePartition")), dataIndex: "name", key: "name" },
    {
      title: t(p("tablePartitionDescription")),
      dataIndex: "description",
      key: "description",
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
      render: (lines: ReactNode[]) => (
        <div>
          {lines?.map((line, index) => (
            <div key={`${index}-${String(line)}`}>{line}</div>
          ))}
        </div>
      ),
    },
    { title: t(p("tableIdleNodes")), dataIndex: "idleNodes", key: "idleNodes" },
    { title: t(p("tablePendingJobs")), dataIndex: "pendingJobs", key: "pendingJobs" },
  ];
  const cpuColumns: ColumnsType<PartitionRow> = [
    ...baseColumns.slice(0, 4),
    { title: t(p("tableIdleCpu")), dataIndex: "idleCpu", key: "idleCpu" },
    ...baseColumns.slice(4),
  ];
  const gpuColumns: ColumnsType<PartitionRow> = [
    ...baseColumns.slice(0, 4),
    { title: t(p("tableIdleGpu")), dataIndex: "idleGpu", key: "idleGpu" },
    ...baseColumns.slice(4),
  ];

  const gpuRows = useMemo(() => partitionRows.filter((row) => row.kind === "gpu"), [partitionRows]);
  const cpuRows = useMemo(() => partitionRows.filter((row) => row.kind === "cpu"), [partitionRows]);
  const sortedGpuRows = useMemo(() => [...gpuRows].sort(sortPartitionRows), [gpuRows]);
  const sortedCpuRows = useMemo(() => [...cpuRows].sort(sortPartitionRows), [cpuRows]);

  const selectedKeyInTab = (rows: PartitionRow[]) =>
    selectedPartitionKey && rows.some((row) => row.key === selectedPartitionKey) ? [selectedPartitionKey] : [];
  const getTableScroll = (rows: PartitionRow[]) =>
    rows.length > PARTITION_TABLE_MAX_VISIBLE_ROWS ? { y: PARTITION_TABLE_SCROLL_Y } : undefined;

  const cpuTab = {
    key: "cpu",
    label: t(p("cpuTabLabel")),
    children: (
      <StyledTable
        bordered
        size="small"
        pagination={false}
        rowKey="key"
        columns={cpuColumns}
        dataSource={sortedCpuRows}
        scroll={getTableScroll(sortedCpuRows)}
        rowSelection={{
          type: "radio",
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
        rowKey="key"
        columns={gpuColumns}
        dataSource={sortedGpuRows}
        scroll={getTableScroll(sortedGpuRows)}
        rowSelection={{
          type: "radio",
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
          <RoundedSelect
            size="large"
            options={accountOptions}
            placeholder={t(p("accountPlaceholder"))}
            loading={accountLoading}
            disabled={accountLoading}
            onChange={(value) => form.setFieldValue("account", value)}
          />
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
          <RoundedSelect
            size="large"
            options={qosOptions.map((qos) => ({ label: qos, value: qos }))}
            style={{ width: "50%" }}
            placeholder={qosOptions.length ? t(p("qosPlaceholder")) : t(p("qosEmptyPlaceholder"))}
            disabled={!qosOptions.length}
          />
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
          <RoundedInputNumber
            size="large"
            min={1}
            step={1}
            precision={0}
            style={{ width: "50%" }}
            disabled={inputsDisabled}
            max={nodeCountLimit}
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
            <RoundedInputNumber
              size="large"
              min={1}
              step={1}
              precision={0}
              style={{ width: "50%" }}
              disabled={inputsDisabled}
              max={unitCountLimit}
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
            <RoundedInputNumber
              size="large"
              min={1}
              step={1}
              precision={0}
              style={{ width: "50%" }}
              disabled={inputsDisabled}
              max={unitCountLimit}
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
                maxTimeUnit,
                maxRunningTimeHours,
              ),
            },
          ]}
        >
          <RoundedInputNumberWithAddonAfter
            size="large"
            min={1}
            step={1}
            precision={0}
            style={{ width: "calc(50% - 72px)", minWidth: "130px" }}
            disabled={inputsDisabled}
            addonAfter={
              <AddonAfterSelect
                style={{ minWidth: "72px" }}
                value={maxTimeUnit}
                onChange={(value) => {
                  onMaxTimeUnitChange(value as TimeUnit);
                }}
              >
                <Select.Option value={TimeUnit.MINUTES}>{t(p("minutes"))}</Select.Option>
                <Select.Option value={TimeUnit.HOURS}>{t(p("hours"))}</Select.Option>
                <Select.Option value={TimeUnit.DAYS}>{t(p("days"))}</Select.Option>
              </AddonAfterSelect>
            }
          />
        </InlineFormItem>
      </Form>
    </TitledSectionCard>
  );
};
