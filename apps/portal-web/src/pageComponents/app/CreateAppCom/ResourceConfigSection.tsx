import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";

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
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ReservedAppAttributeName, TimeUnit } from "src/models/job";
import { ReservedAppAttribute } from "src/pages/api/app/getAppMetadata";
import { Partition } from "src/pages/api/cluster";

import type { AccountOption } from "../LaunchAppForm";

import { getReservedAppAttributeConfig } from "../LauchAppFormUtils";
import { AppResourceFormValues, FixedOrEditableFormItem } from "./FixedOrEditableFormItem";

export type PartitionTabKey = "cpu" | "gpu";
const PARTITION_TABLE_SCROLL_Y = 325;
const PARTITION_TABLE_MAX_VISIBLE_ROWS = 5;

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

interface ResourceConfigSectionProps {
  form: FormInstance<AppResourceFormValues>;
  accountOptions: AccountOption[];
  selectedAccount?: string;
  clusterName?: string;
  clusterDisabled?: boolean;
  partitionRows: PartitionRow[];
  activePartitionTab: PartitionTabKey;
  onActivePartitionTabChange: (tab: PartitionTabKey) => void;
  selectedPartitionKey?: string;
  onPartitionSelect: (partitionName: string | undefined) => void;
  qosOptions: string[];
  inputsDisabled?: boolean;
  maxTimeUnit: TimeUnit;
  onMaxTimeUnitChange: (unit: TimeUnit) => void;
  selectedPresetUnit?: TimeUnit;
  onSelectedPresetUnitChange: (unit: TimeUnit | undefined) => void;
  languageId: string;
  appId: string;
  clusterId: string;
  reservedAppAttributes?: ReservedAppAttribute[];
  currentPartitionInfo: Partition | undefined;
  maxRunningTimeHours?: number;
}

const p = prefix("pageComp.app.launchAppForm.");
const PARTITION_TABLE_SELECTION_WIDTH = 48;
const MAX_TIME_UNITS: MaxTimeUnits<TimeUnit> = {
  minutes: TimeUnit.MINUTES,
  hours: TimeUnit.HOURS,
  days: TimeUnit.DAYS,
};
const MAX_TIME_PRESETS = createMaxTimePresets(MAX_TIME_UNITS);

export const ResourceConfigSection = ({
  form,
  accountOptions,
  selectedAccount,
  clusterName,
  clusterDisabled = false,
  partitionRows,
  activePartitionTab,
  onActivePartitionTabChange,
  selectedPartitionKey,
  onPartitionSelect,
  qosOptions,
  inputsDisabled,
  maxTimeUnit,
  onMaxTimeUnitChange,
  selectedPresetUnit,
  onSelectedPresetUnitChange,
  languageId,
  appId,
  clusterId,
  reservedAppAttributes,
  currentPartitionInfo,
  maxRunningTimeHours,
}: ResourceConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const maxTimeReservedConfig = getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.MAX_TIME);
  const effectiveMaxTimeUnit = selectedPresetUnit ?? maxTimeUnit;
  const maxTimeValidatorUnit = maxTimeReservedConfig ? "min" : effectiveMaxTimeUnit;

  const selectedQos = Form.useWatch<string | undefined>("qos", form);

  const baseColumns: ColumnsType<PartitionRow> = [
    { title: t(p("partition")), dataIndex: "name", key: "name", width: "14%" },
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

  const gpuRows = partitionRows.filter((row) => row.kind === "gpu");
  const cpuRows = partitionRows.filter((row) => row.kind === "cpu");
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
        tableLayout="fixed"
        rowKey="key"
        columns={cpuColumns}
        dataSource={cpuRows}
        scroll={getTableScroll(cpuRows)}
        rowSelection={{
          type: "radio",
          columnWidth: PARTITION_TABLE_SELECTION_WIDTH,
          selectedRowKeys: activePartitionTab === "cpu" ? selectedKeyInTab(cpuRows) : [],
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
        dataSource={gpuRows}
        scroll={getTableScroll(gpuRows)}
        rowSelection={{
          type: "radio",
          columnWidth: PARTITION_TABLE_SELECTION_WIDTH,
          selectedRowKeys: activePartitionTab === "gpu" ? selectedKeyInTab(gpuRows) : [],
          onChange: (keys) => onPartitionSelect(keys[0] as string),
        }}
        rowClassName={(record) => (record.key === selectedPartitionKey ? "selected-row" : "")}
      />
    ),
  };
  return (
    <TitledSectionCard title={<SectionTitle>{t(p("sectionTitle"))}</SectionTitle>}>
      <Form form={form} colon={false} requiredMark={false}>
        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="account"
          label={<FormLabel>{t(p("account"))}</FormLabel>}
          rules={[{ required: true }]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT)}
          children={
            <Space wrap>
              {accountOptions.map(({ label, value, disabled, disabledReason }) => {
                const button = (
                  <RoundedButton
                    size="large"
                    key={value}
                    type={selectedAccount === value ? "primary" : "default"}
                    $selected={selectedAccount === value}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
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
          }
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          onChange={(value) => form.setFieldValue("account", value)}
          appId={appId}
          clusterId={clusterId}
        />
        <InlineFormItem
          name="cluster"
          label={<FormLabel>{t(p("clusterLabel"))}</FormLabel>}
          rules={[{ required: true, message: t(p("clusterRequired")) }]}
        >
          <Space wrap>
            {clusterName &&
              (clusterDisabled ? (
                <Tooltip title={t(p("clusterUnauthorized"))} arrow={false} align={{ offset: [0, -12] }}>
                  <span>
                    <RoundedButton size="large" disabled>
                      {clusterName}
                    </RoundedButton>
                  </span>
                </Tooltip>
              ) : (
                <RoundedButton size="large" type="primary" $selected>
                  {clusterName}
                </RoundedButton>
              ))}
          </Space>
        </InlineFormItem>

        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="partition"
          label={<FormLabel>{t(p("partition"))}</FormLabel>}
          rules={[{ required: true }]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.PARTITION)}
          children={
            <StyledTabs
              activeKey={activePartitionTab}
              onChange={(key) => onActivePartitionTabChange(key as PartitionTabKey)}
              type="line"
              items={[cpuTab, gpuTab]}
            />
          }
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          appId={appId}
          clusterId={clusterId}
        />
        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="qos"
          label={<FormLabel>{t(p("qos"))}</FormLabel>}
          rules={[{ required: true }]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.QOS)}
          children={
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
                  {t(p("noSelectableQos"))}
                </RoundedButton>
              )}
            </Space>
          }
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          appId={appId}
          clusterId={clusterId}
        />
        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="nodeCount"
          label={<FormLabel>{t(p("nodeCount"))}</FormLabel>}
          dependencies={["partition"]}
          rules={[
            { required: true, message: t(p("nodeCountRequired")) },
            { type: "integer", message: t(p("nodeCountRequired")) },
            ...(currentPartitionInfo?.nodes
              ? [
                  {
                    type: "integer" as const,
                    max: currentPartitionInfo.nodes,
                    message: t(p("nodeCountExceedsMaxTooltip")),
                  },
                ]
              : []),
          ]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.NODE_COUNT)}
          children={
            <PresetNumberSelector
              disabled={inputsDisabled}
              max={currentPartitionInfo?.nodes}
              placeholder={t(p("nodeCountOtherPlaceholder"))}
              disabledTooltip={t(p("nodeCountExceedsMaxTooltip"))}
            />
          }
          isNumberAttribute={true}
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          appId={appId}
          clusterId={clusterId}
        />
        {activePartitionTab === "gpu" ? (
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="gpuCount"
            label={<FormLabel>{t(p("gpuCount"))}</FormLabel>}
            dependencies={["partition"]}
            rules={[
              { required: true, message: t(p("gpuCoresRequired")) },
              { type: "number" as const, min: 1, message: t(p("gpuCoresRequired")) },
              ...(currentPartitionInfo?.gpus
                ? [
                    {
                      type: "number" as const,
                      max: currentPartitionInfo.gpus / currentPartitionInfo?.nodes,
                      message: t(p("nodeCountExceedsMaxTooltip")),
                    },
                  ]
                : []),
            ]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.GPU_COUNT)}
            children={
              <PresetNumberSelector
                disabled={inputsDisabled}
                max={currentPartitionInfo?.gpus ? currentPartitionInfo.gpus / currentPartitionInfo.nodes : undefined}
                placeholder={t(p("nodeCountOtherPlaceholder"))}
                disabledTooltip={t(p("nodeCountExceedsMaxTooltip"))}
              />
            }
            isNumberAttribute={true}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            appId={appId}
            clusterId={clusterId}
          />
        ) : (
          <FixedOrEditableFormItem
            form={form}
            languageId={languageId}
            t={t}
            name="coreCount"
            label={<FormLabel>{t(p("coreCount"))}</FormLabel>}
            dependencies={["partition"]}
            rules={[
              { required: true, message: t(p("cpuCoresRequired")) },
              { type: "integer" as const, message: t(p("cpuCoresRequired")) },
              ...(currentPartitionInfo
                ? [
                    {
                      type: "integer" as const,
                      max: currentPartitionInfo.cores / currentPartitionInfo.nodes,
                      message: t(p("nodeCountExceedsMaxTooltip")),
                    },
                  ]
                : []),
            ]}
            reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.CORE_COUNT)}
            children={
              <PresetNumberSelector
                disabled={inputsDisabled}
                max={currentPartitionInfo ? currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined}
                placeholder={t(p("nodeCountOtherPlaceholder"))}
                disabledTooltip={t(p("nodeCountExceedsMaxTooltip"))}
              />
            }
            isNumberAttribute={true}
            currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
            appId={appId}
            clusterId={clusterId}
          />
        )}
        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="maxTime"
          label={<FormLabel>{t(p("maxTime"))}</FormLabel>}
          rules={[
            { required: true, message: t(p("maxTimeRequired")) },
            {
              validator: validateConfigMaxJobRunningHours(
                t(p("maxRunTimeExceed"), [maxRunningTimeHours?.toString() ?? ""]),
                t(p("maxTimePositive")),
                maxTimeValidatorUnit,
                maxRunningTimeHours,
              ),
            },
          ]}
          reservedConfig={maxTimeReservedConfig}
          children={
            <MaxTimeSelector
              disabled={inputsDisabled}
              maxRunningTimeHours={maxRunningTimeHours}
              disabledTooltip={t(p("maxRunTimeExceed"), [maxRunningTimeHours?.toString() ?? ""])}
              maxTimeUnit={maxTimeUnit}
              onMaxTimeUnitChange={onMaxTimeUnitChange}
              selectedPresetUnit={selectedPresetUnit}
              onSelectedPresetUnitChange={onSelectedPresetUnitChange}
              labels={{
                minutes: t(p("minute")),
                hours: t(p("hour")),
                days: t(p("day")),
                otherValue: t(p("nodeCountOtherPlaceholder")),
              }}
              units={MAX_TIME_UNITS}
              presets={MAX_TIME_PRESETS}
            />
          }
          isNumberAttribute={true}
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          appId={appId}
          clusterId={clusterId}
        />
      </Form>
    </TitledSectionCard>
  );
};
