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
import { Form, type FormInstance, Select, Space, Switch, Tooltip } from "antd";
import { useEffect, useMemo, useRef } from "react";
import { type ClusterNodesInfo, getMaxPodsByNodes, getQueueNodes } from "src/app/(auth)/jobs/common";
import { InferInlineFormItem as InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { useQueueTabSelection } from "src/app/(auth)/jobs/hooks/useQueueTabSelection";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useTheme } from "styled-components";

import type {
  CPUQueueRow,
  GPUQueueRow,
  MaxTimeUnit,
  QueueKind,
  QueueRow,
  ResourceFormValues,
} from "../LaunchInferForm.types";

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
  queueNodesInfo?: ClusterNodesInfo;
  qosOptions: string[];
  maxTimeUnit: MaxTimeUnit;
  onMaxTimeUnitChange: (unit: MaxTimeUnit) => void;
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
  gpuUnitLimit,
  isResubmit,
}: ResourceConfigSectionProps) => {
  const theme = useTheme();
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

  const perNodeFieldName = activeResourceTab === "gpu" ? "gpuCores" : "cpuCores";
  const inputsDisabled = !selectedQueueOption;
  const isMaxTimeUnlimited = Form.useWatch<boolean>("maxTimeUnlimited", form) ?? false;
  const isMaxTimeLimited = !isMaxTimeUnlimited;
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
  const controlHeightLg = theme.token.controlHeightLG ?? 40;
  const handleMaxTimeUnlimitedChange = (checked: boolean) => {
    if (!checked) {
      form.setFieldValue("maxTime", undefined);
    }
    form.validateFields(["maxTime"]).catch(() => undefined);
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
    <SectionCard title={<SectionTitle>{t(p("title"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
        initialValues={{ queue: activeResourceTab, nodeCount: 1, maxTimeUnlimited: false }}
      >
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
            style={{ width: "480px" }}
          />
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
          <RoundedInputNumber
            size="large"
            min={1}
            step={1}
            precision={0}
            disabled={inputsDisabled}
            style={{ width: "480px" }}
          />
        </InlineFormItem>

        {activeResourceTab === "gpu" ? (
          <InlineFormItem
            name="gpuCores"
            label={<Label>{gpuCountLabel}</Label>}
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
            <RoundedInputNumber
              size="large"
              min={1}
              step={1}
              precision={0}
              disabled={inputsDisabled}
              max={gpuInputLimit}
              style={{ width: "480px" }}
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
            <RoundedInputNumber
              size="large"
              min={1}
              step={1}
              precision={0}
              disabled={inputsDisabled}
              max={cpuInputLimit}
              style={{ width: "480px" }}
            />
          </InlineFormItem>
        ) : null}

        <InlineFormItem
          label={<Label>{t(p("maxRunTimeLabel"))}</Label>}
          rules={[{ required: true, message: t(p("maxRunTimeRequired")) }]}
          helpTip={t(p("maxRunTimeHelp"))}
        >
          <div style={{ width: "408px", minHeight: controlHeightLg, display: "flex", alignItems: "center", gap: 12 }}>
            <Form.Item
              name="maxTimeUnlimited"
              valuePropName="checked"
              getValueProps={(value: boolean | undefined) => ({ checked: !value })}
              getValueFromEvent={(checked: boolean) => !checked}
              noStyle
            >
              <Switch
                onChange={handleMaxTimeUnlimitedChange}
                aria-label={t(p("maxRunTimeLimitedLabel"))}
                checkedChildren={t(p("maxRunTimeLimitedLabel"))}
                unCheckedChildren={t(p("maxRunTimeUnlimitedLabel"))}
              />
            </Form.Item>
            {isMaxTimeLimited ? (
              <Form.Item
                name="maxTime"
                style={{ flex: 1, marginBottom: 0 }}
                rules={[{ required: true, message: t(p("maxRunTimeRequired")) }]}
              >
                <RoundedInputNumberWithAddonAfter
                  size="large"
                  min={1}
                  step={1}
                  style={{ width: "100%" }}
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
              </Form.Item>
            ) : null}
          </div>
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
