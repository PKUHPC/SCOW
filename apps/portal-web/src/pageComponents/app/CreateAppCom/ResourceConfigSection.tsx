import { RoundedButton } from "@scow/lib-web/build/components/styledAntdCom/Button";
import { FormLabel } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInputNumber, RoundedInputNumberWithAddonAfter }
  from "@scow/lib-web/build/components/styledAntdCom/Input";
import { AddonAfterSelect } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import { StyledTable } from "@scow/lib-web/build/components/styledAntdCom/Table";
import { StyledTabs } from "@scow/lib-web/build/components/styledAntdCom/Tabs";
import { SectionTitle,TitledSectionCard } from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { Tooltip } from "@scow/lib-web/build/components/styledAntdCom/Tooltip";
import { Form, type FormInstance, Select, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { ReservedAppAttributeName } from "src/models/job";
import { ReservedAppAttribute } from "src/pages/api/app/getAppMetadata";
import { Partition } from "src/pages/api/cluster";

import { getReservedAppAttributeConfig } from "../LaunchAppForm";
import { AppResourceFormValues,FixedOrEditableFormItem } from "./FixedOrEditableFormItem";

interface ClusterOption {
  id: string;
  name: string;
  disabled: boolean;
}

export type PartitionTabKey = "cpu" | "gpu";
const PARTITION_TABLE_SCROLL_Y = 325;
const PARTITION_TABLE_MAX_VISIBLE_ROWS = 5;

export type TimeUnit = "min" | "hour" | "day";

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
  accountOptions: string[];
  clusterOptions: ClusterOption[];
  selectedCluster?: string;
  partitionRows: PartitionRow[];
  activePartitionTab: PartitionTabKey;
  onActivePartitionTabChange: (tab: PartitionTabKey) => void;
  selectedPartitionKey?: string;
  onPartitionSelect: (partitionName: string | undefined) => void;
  qosOptions: string[];
  inputsDisabled?: boolean;
  maxTimeUnit: TimeUnit;
  onMaxTimeUnitChange: (unit: TimeUnit) => void;
  languageId: string;
  appId: string;
  clusterId: string;
  reservedAppAttributes?: ReservedAppAttribute[];
  currentPartitionInfo: Partition | undefined;
}

const p = prefix("pageComp.app.launchAppForm.");

export const ResourceConfigSection = ({
  form,
  accountOptions,
  clusterOptions,
  selectedCluster,
  partitionRows,
  activePartitionTab,
  onActivePartitionTabChange,
  selectedPartitionKey,
  onPartitionSelect,
  qosOptions,
  inputsDisabled,
  maxTimeUnit,
  onMaxTimeUnitChange,
  languageId,
  appId,
  clusterId,
  reservedAppAttributes,
  currentPartitionInfo,
}: ResourceConfigSectionProps) => {
  const t = useI18nTranslateToString();

  const inputNumberFloorConfig = {
    formatter: (value: number) => `${Math.floor(value)}`,
    parser: (value: string) => Math.floor(+value),
  };

  const baseColumns: ColumnsType<PartitionRow> = [
    { title: t(p("partition")), dataIndex: "name", key: "name" },
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

  const gpuRows = partitionRows.filter((row) => row.kind === "gpu");
  const cpuRows = partitionRows.filter((row) => row.kind === "cpu");
  const selectedKeyInTab = (rows: PartitionRow[]) =>
    selectedPartitionKey && rows.some((row) => row.key === selectedPartitionKey)
      ? [selectedPartitionKey]
      : [];
  const getTableScroll = (rows: PartitionRow[]) => rows.length > PARTITION_TABLE_MAX_VISIBLE_ROWS
    ? { y: PARTITION_TABLE_SCROLL_Y }
    : undefined;

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
        dataSource={cpuRows}
        scroll={getTableScroll(cpuRows)}
        rowSelection={{
          type: "radio",
          selectedRowKeys: activePartitionTab === "cpu" ? selectedKeyInTab(cpuRows) : [],
          onChange: (keys) => onPartitionSelect(keys[0] as string),
        }}
        rowClassName={(record) => record.key === selectedPartitionKey ? "selected-row" : ""}
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
        dataSource={gpuRows}
        scroll={getTableScroll(gpuRows)}
        rowSelection={{
          type: "radio",
          selectedRowKeys: activePartitionTab === "gpu" ? selectedKeyInTab(gpuRows) : [],
          onChange: (keys) => onPartitionSelect(keys[0] as string),
        }}
        rowClassName={(record) => record.key === selectedPartitionKey ? "selected-row" : ""}
      />
    ),
  };
  return (
    <TitledSectionCard title={<SectionTitle>{t(p("sectionTitle"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
      >
        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="account"
          label={<FormLabel>{t(p("account"))}</FormLabel>}
          rules={[
            { required: true },
          ]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.ACCOUNT)}
          children={(
            <RoundedSelect
              size="large"
              options={accountOptions?.map((account) => ({ label: account, value: account }))}
              placeholder={t(p("accountPlaceholder"))}
              onChange={(value) => form.setFieldValue("account", value)}
            />
          )}
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          onChange={(value) => form.setFieldValue("account", value)}
          appId={appId}
          clusterId={clusterId}
        />

        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="cluster"
          label={<FormLabel>{t(p("clusterLabel"))}</FormLabel>}
          rules={[
            { required: true, message: t(p("clusterRequired")) },
          ]}
          children={(
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
                      if (disabled) { return; }
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
                  <Tooltip
                    key={id}
                    title={t(p("clusterUnauthorized"))}
                    arrow={false}
                    align={{ offset: [0, -12]}}
                  >
                    <span>{button}</span>
                  </Tooltip>
                );
              })}
            </Space>
          )}
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          onChange={(value) => form.setFieldValue("cluster", value)}
          appId={appId}
          clusterId={clusterId}
        />

        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="partition"
          label={<FormLabel>{t(p("partition"))}</FormLabel>}
          rules={[
            { required: true },
          ]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.PARTITION)}
          children={(
            <StyledTabs
              activeKey={activePartitionTab}
              onChange={(key) => onActivePartitionTabChange(key as PartitionTabKey)}
              type="line"
              items={[cpuTab, gpuTab]}
            />
          )}
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
          rules={[
            { required: true },
          ]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.QOS)}
          children={(
            <RoundedSelect
              size="large"
              options={qosOptions.map((qos) => ({ label: qos, value: qos }))}
              style={{ width: "50%" }}
              placeholder={qosOptions.length ? t(p("qosPlaceholder")) : t(p("noSelectableQos"))}
              disabled={!qosOptions.length}
            />
          )}
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
            { required: true,
              type: "integer",
              max: currentPartitionInfo?.nodes,
              message: t(p("nodeCountRequired")),
           },
          ]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.NODE_COUNT)}
          children={(
            <RoundedInputNumber
              min={1}
              max={currentPartitionInfo?.nodes}
              {...inputNumberFloorConfig}
              disabled={inputsDisabled}
            />
          )}
          isNumberAttribute={true}
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          appId={appId}
          clusterId={clusterId}
        />
        {
          activePartitionTab === "gpu" ? (
            <FixedOrEditableFormItem
              form={form}
              languageId={languageId}
              t={t}
              name="gpuCount"
              label={<FormLabel>{t(p("gpuCount"))}</FormLabel>}
              dependencies={["partition"]}
              rules={[
                { required: true, message: t(p("gpuCoresRequired")) },
                { type: "number" as const, min: 1 },
                ...(currentPartitionInfo?.gpus ? [{ type: "number" as const, max: currentPartitionInfo.gpus / currentPartitionInfo?.nodes }] : []),
              ]}
              reservedConfig={
                getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.GPU_COUNT)}
              children={(
                <RoundedInputNumber
                  min={1}
                  max={currentPartitionInfo?.gpus ? currentPartitionInfo.gpus / currentPartitionInfo.nodes : undefined }
                  {...inputNumberFloorConfig}
                  disabled={inputsDisabled}
                />
              )}
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
                { required: true,
                  type: "integer",
                  max: currentPartitionInfo ?
                    currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined,
                  message: t(p("cpuCoresRequired")),
                },
              ]}
              reservedConfig={
                getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.CORE_COUNT)}
              children={(
                <RoundedInputNumber
                  min={1}
                  max={currentPartitionInfo ?
                    currentPartitionInfo.cores / currentPartitionInfo.nodes : undefined }
                  {...inputNumberFloorConfig}
                  disabled={inputsDisabled}
                />
              )}
              isNumberAttribute={true}
              currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
              appId={appId}
              clusterId={clusterId}
            />
          )
        }
        <FixedOrEditableFormItem
          form={form}
          languageId={languageId}
          t={t}
          name="maxTime"
          label={<FormLabel>{t(p("maxTime"))}</FormLabel>}
          rules={[{ required: true, message: t(p("maxTimeRequired")) }]}
          reservedConfig={getReservedAppAttributeConfig(reservedAppAttributes, ReservedAppAttributeName.MAX_TIME)}
          children={(
            <RoundedInputNumberWithAddonAfter
              size="large"
              min={1}
              step={1}
              precision={0}
              style={{ width: "calc(50% - 90px)", minWidth: "130px" }}
              disabled={inputsDisabled}
              addonAfter={
                (
                  <AddonAfterSelect
                    style={{ minWidth: "90px" }}
                    value={maxTimeUnit}
                    onChange={(value) => onMaxTimeUnitChange(value)}
                  >
                    <Select.Option value="min">{t(p("minute"))}</Select.Option>
                    <Select.Option value="hour">{t(p("hour"))}</Select.Option>
                    <Select.Option value="day">{t(p("day"))}</Select.Option>
                  </AddonAfterSelect>
                )
              }
            />
          )}
          isNumberAttribute={true}
          currentPartitionIsWithGpu={!!currentPartitionInfo?.gpus}
          appId={appId}
          clusterId={clusterId}
        />
      </Form>
    </TitledSectionCard>
  );
};
