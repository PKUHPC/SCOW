import { MinusSquareOutlined, PlusOutlined, PlusSquareOutlined } from "@ant-design/icons";
import { App, Button, Divider, Form, InputNumber, Modal, Select, Space, Table, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { RemoveTierIcon } from "src/assets/operationIcon";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getStorageDisplayName } from "src/utils/storageDisplay";
import { styled } from "styled-components";

interface StoragePriceTier {
  startTb: number;
  pricePerTbPerDay: number;
}

type StorageSizeUnit = "GB" | "TB";

interface OriginalStoragePriceTier {
  startSize: number;
  endSize?: number;
  unit: StorageSizeUnit;
  pricePerTbPerDay: number;
}

export interface StorageBillingItem {
  id: number;
  storageId: string;
  billingMode: number;
  tiers: StoragePriceTier[];
  originalTiers?: OriginalStoragePriceTier[];
  tenantName?: string;
  createTime: string;
  description: string;
}

export interface StorageBillingData {
  storageId: string;
  activeItem?: StorageBillingItem;
  historyItems: StorageBillingItem[];
}

interface Props {
  data: StorageBillingData[];
  loading: boolean;
  reload: () => void;
  tenantName?: string;
  canEdit: boolean;
}

const p = prefix("page.storageBilling.");

const billingModeText = (mode: number, t: ReturnType<typeof useI18nTranslateToString>) => {
  switch (mode) {
    case 1: return t(p("usage"));
    case 2: return t(p("quota"));
    default: return t(p("unknown"));
  }
};

interface StoragePriceTierFormValue {
  startSize?: number;
  endSize?: number;
  unit: StorageSizeUnit;
  pricePerTbPerDay: number;
}

const storageSizeUnitOptions = [
  { label: "GB", value: "GB" },
  { label: "TB", value: "TB" },
] satisfies { label: StorageSizeUnit; value: StorageSizeUnit }[];

const storageSizeToTb = (value: number | undefined, unit: StorageSizeUnit) =>
  value == null ? undefined : unit === "GB" ? value / 1024 : value;

const tbToStorageSize = (valueTb: number | undefined, unit: StorageSizeUnit) =>
  valueTb == null ? undefined : unit === "GB" ? valueTb * 1024 : valueTb;

const normalizeTierStarts = (tiers: StoragePriceTierFormValue[]) => {
  let needUpdate = false;

  if (tiers[0] && tiers[0].startSize !== 0) {
    tiers[0] = { ...tiers[0], startSize: 0 };
    needUpdate = true;
  }

  for (let i = 1; i < tiers.length; i++) {
    const prevTier = tiers[i - 1];
    const currentTier = tiers[i];
    const currentUnit = currentTier?.unit ?? "TB";
    const prevEndTb = storageSizeToTb(prevTier?.endSize, prevTier?.unit ?? "TB");
    const nextStartSize = tbToStorageSize(prevEndTb, currentUnit);
    if (currentTier?.startSize !== nextStartSize) {
      tiers[i] = { ...currentTier, startSize: nextStartSize };
      needUpdate = true;
    }
  }

  return needUpdate;
};

const formatDateTime = (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm:ss");

const TableContainer = styled.div`
  margin-top: 12px;
  background: #fff;
  border-radius: 4px;

  .ant-table-wrapper .ant-table {
    color: #434343;
  }

  .ant-table-wrapper .ant-table-container {
    border-color: #d9d9d9;
  }

  .ant-table-thead > tr > th {
    height: 56px;
    background: #fafafa;
    font-weight: 500;
  }

  .ant-table-cell {
    vertical-align: middle;
  }

  .storage-billing-history-header > td {
    background: #fafafa;
    font-weight: 500;
  }

  .storage-billing-history-side-cell {
    background: #fafafa;
  }

  .storage-billing-expand-cell {
    text-align: center;
  }
`;

const PriceCell = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 22px;
  margin: -16px;

  > span {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 54px;
    padding: 0 16px;
  }

  > span + span {
    border-left: 1px solid #f0f0f0;
  }
`;

const FormHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 24px 1fr 1.2fr 40px;
  column-gap: 16px;
  margin-bottom: 8px;
  padding: 0 18px;
  color: #434343;
  font-weight: 500;
`;

const TierRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 24px 1fr 1.2fr 40px;
  column-gap: 16px;
  align-items: start;
  margin-bottom: 8px;
  padding: 15px 18px;
  background: #fafafa;
  border-radius: 8px;

  .storage-billing-tier-form-item {
    min-height: 54px;
    margin-bottom: 0;
  }

  .storage-billing-tier-form-item .ant-form-item-explain {
    min-height: 22px;
  }

  .storage-billing-tier-separator {
    padding-top: 5px;
    text-align: center;
  }
`;

const RemoveTierBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.token.colorPrimary};
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }
`;

const UnitSelect = styled(Select)`
  width: 72px;

  && .ant-select-selector {
    box-shadow: none !important;
  }

  &&:hover .ant-select-selector,
  &&.ant-select-focused .ant-select-selector,
  &&.ant-select-open .ant-select-selector,
  && .ant-select-selector:focus,
  && .ant-select-selector:focus-within {
    border-color: ${({ theme }) => theme.token.colorPrimary} !important;
    box-shadow: none !important;
  }

  &&:hover .ant-select-arrow,
  &&.ant-select-focused .ant-select-arrow,
  &&.ant-select-open .ant-select-arrow {
    color: ${({ theme }) => theme.token.colorPrimary};
  }
`;

const formatBillingId = (id: number) => `STOR-${String(id).padStart(4, "0")}`;

interface TableRow {
  kind: "active" | "historyHeader" | "history";
  key: string;
  storageId: string;
  id: number;
  billingMode: number;
  tierIndex: number;
  tierTotal: number;
  startTb: number;
  endTb: number | null;
  rangeText: string;
  pricePerTbPerDay: number;
  createTime: string;
  hasHistory: boolean;
  historyItems: StorageBillingItem[];
  isSet: boolean;
  validEndTime?: string;
  historyBlockSize?: number;
}

const getPriceRangeText = (startTb: number, endTb: number | null) =>
  endTb != null ? `${startTb}TB-${endTb}TB` : `${startTb}TB+`;

const getOriginalPriceRangeText = (tier: OriginalStoragePriceTier) =>
  tier.endSize != null
    ? `${tier.startSize}${tier.unit}-${tier.endSize}${tier.unit}`
    : `${tier.startSize}${tier.unit}+`;

const renderPriceCell = (rangeText: string, pricePerTbPerDay: number) => (
  <PriceCell>
    <span>{rangeText}</span>
    <span>{pricePerTbPerDay}</span>
  </PriceCell>
);

function buildRowsForItem(
  item: StorageBillingItem,
  storageId: string,
  hasHistory: boolean,
  historyItems: StorageBillingItem[],
  kind: "active" | "history",
  validEndTime?: string,
) {
  const tiers = item.tiers.length > 0 ? item.tiers : [{ startTb: 0, pricePerTbPerDay: 0 }];
  const originalTiers = item.originalTiers?.length
    ? item.originalTiers
    : tiers.map((tier, i) => ({
      startSize: tier.startTb,
      endSize: tiers[i + 1]?.startTb,
      unit: "TB",
      pricePerTbPerDay: tier.pricePerTbPerDay,
    } satisfies OriginalStoragePriceTier));

  return tiers.map((tier, i) => {
    const nextTier = tiers[i + 1];
    const originalTier = originalTiers[i];
    return {
      kind,
      key: `${kind}-${storageId}-${item.id}-${i}`,
      storageId,
      id: item.id,
      billingMode: item.billingMode,
      tierIndex: i,
      tierTotal: tiers.length,
      startTb: tier.startTb,
      endTb: nextTier ? nextTier.startTb : null,
      rangeText: originalTier
        ? getOriginalPriceRangeText(originalTier)
        : getPriceRangeText(tier.startTb, nextTier ? nextTier.startTb : null),
      pricePerTbPerDay: tier.pricePerTbPerDay,
      createTime: item.createTime,
      hasHistory,
      historyItems,
      isSet: true,
      validEndTime,
    } satisfies TableRow;
  });
}

function buildTableRows(
  dataList: StorageBillingData[],
  expandedStorageIds: Set<string>,
): TableRow[] {
  const rows: TableRow[] = [];

  for (const d of dataList) {
    const { storageId, activeItem, historyItems } = d;
    const hasHistory = historyItems.length > 0;

    if (!activeItem) {
      rows.push({
        kind: "active",
        key: `${storageId}-unset`,
        storageId,
        id: 0,
        billingMode: 0,
        tierIndex: 0,
        tierTotal: 1,
        startTb: 0,
        endTb: null,
        rangeText: getPriceRangeText(0, null),
        pricePerTbPerDay: 0,
        createTime: "-",
        hasHistory,
        historyItems,
        isSet: false,
      });
    } else {
      rows.push(...buildRowsForItem(activeItem, storageId, hasHistory, historyItems, "active"));
    }

    if (hasHistory && expandedStorageIds.has(storageId)) {
      const historyRows: TableRow[] = [];
      const sortedHistoryItems = [...historyItems].sort(
        (a, b) => dayjs(b.createTime).valueOf() - dayjs(a.createTime).valueOf(),
      );
      for (let i = 0; i < sortedHistoryItems.length; i++) {
        const item = sortedHistoryItems[i];
        const nextNewerItem = i === 0 ? activeItem : sortedHistoryItems[i - 1];
        historyRows.push(...buildRowsForItem(
          item,
          storageId,
          hasHistory,
          historyItems,
          "history",
          nextNewerItem?.createTime,
        ));
      }

      rows.push({
        kind: "historyHeader",
        key: `${storageId}-history-header`,
        storageId,
        id: 0,
        billingMode: 0,
        tierIndex: 0,
        tierTotal: 1,
        startTb: 0,
        endTb: null,
        rangeText: "",
        pricePerTbPerDay: 0,
        createTime: "",
        hasHistory,
        historyItems,
        isSet: false,
        historyBlockSize: historyRows.length + 1,
      });
      rows.push(...historyRows);
    }
  }

  return rows;
}

const SetPriceModal: React.FC<{
  open: boolean;
  onClose: () => void;
  storageId: string;
  activeItem?: StorageBillingItem;
  tenantName?: string;
  reload: () => void;
}> = ({ open, onClose, storageId, activeItem, tenantName, reload }) => {

  const { message } = App.useApp();
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicStorageConfigs } = useStore(ClusterInfoStore);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accountStorageQuotaEnabled, setAccountStorageQuotaEnabled] = useState(false);

  const displayName = getStorageDisplayName(storageId, languageId, publicStorageConfigs);
  const initialTiers: StoragePriceTierFormValue[] = activeItem?.originalTiers?.length
    ? activeItem.originalTiers
    : activeItem?.tiers.map((tier, i) => ({
      startSize: tier.startTb,
      endSize: activeItem.tiers[i + 1]?.startTb,
      unit: "TB",
      pricePerTbPerDay: tier.pricePerTbPerDay,
    })) ?? [{ startSize: 0, endSize: undefined, unit: "TB", pricePerTbPerDay: 0 }];

  useEffect(() => {
    if (!open) return;

    setAccountStorageQuotaEnabled(false);
    api.getAccountStorageQuotaState({})
      .then(({ state }) => setAccountStorageQuotaEnabled(state === "ENABLED"))
      .catch(() => undefined);
  }, [open]);

  const renderUnitSelect = (fieldName: number) => (
    <Form.Item noStyle shouldUpdate>
      {() => (
        <UnitSelect
          value={form.getFieldValue(["tiers", fieldName, "unit"])}
          options={storageSizeUnitOptions}
          onChange={(unit) => {
            const tiers = [...(form.getFieldValue("tiers") || [])] as StoragePriceTierFormValue[];
            tiers[fieldName] = { ...tiers[fieldName], unit: unit as StorageSizeUnit };
            normalizeTierStarts(tiers);
            form.setFieldsValue({ tiers });
          }}
        />
      )}
    </Form.Item>
  );

  const onOk = async () => {
    const values = await form.validateFields();
    if (values.billingMode === 2 && !accountStorageQuotaEnabled) {
      message.error(t(p("quotaModeRequiresAccountStorageQuota")));
      return;
    }

    const originalTiers = values.tiers as StoragePriceTierFormValue[];
    if (originalTiers[originalTiers.length - 1]?.endSize != null) {
      message.error(t(p("lastTierMustBeNoLimit")));
      return;
    }

    setLoading(true);
    try {
      const tiers = originalTiers
        .map((t) => ({
          startTb: storageSizeToTb(t.startSize, t.unit) ?? 0,
          pricePerTbPerDay: t.pricePerTbPerDay,
        }))
        .sort((a, b) => a.startTb - b.startTb);

      await api.addStorageBillingItem({ body: {
        storageId,
        billingMode: values.billingMode,
        tiers,
        originalTiers: originalTiers.map((tier) => ({
          startSize: tier.startSize ?? 0,
          endSize: tier.endSize,
          unit: tier.unit,
          pricePerTbPerDay: tier.pricePerTbPerDay,
        })),
        tenantName,
        description: values.description || "",
      } });

      message.success(t(p("setPriceSuccess")));
      onClose();
      reload();
    } catch {
      message.error(t(p("saveFailed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t(p("setStoragePrice"))}
      open={open}
      onCancel={onClose}
      onOk={onOk}
      confirmLoading={loading}
      destroyOnClose
      width={865}
      okText={t(p("save"))}
      cancelText={t("common.cancel")}
    >
      <Form
        form={form}
        preserve={false}
        onValuesChange={(changed, all) => {
          if (!changed.tiers) return;
          const tiers = [...(all.tiers || [])] as StoragePriceTierFormValue[];
          const needUpdate = normalizeTierStarts(tiers);
          if (needUpdate) {
            form.setFieldsValue({ tiers });
          }
        }}
        initialValues={{
          billingMode: activeItem?.billingMode ?? 1,
          tiers: initialTiers,
        }}
      >
        <Space direction="vertical" size={16} style={{ width: "100%", marginTop: 8 }}>
          <Space size={64}>
            <Typography.Text type="secondary">{t(p("fileSystem"))}</Typography.Text>
            <Typography.Text>{displayName}</Typography.Text>
          </Space>
          <Space size={50}>
            <Typography.Text type="secondary">{t(p("newBillingId"))}</Typography.Text>
            <Typography.Text>{t(p("generatedAfterSave"))}</Typography.Text>
          </Space>
        </Space>
        <Form.Item
          name="billingMode"
          label={t(p("billingMode"))}
          rules={[{ required: true, message: t(p("selectBillingMode")) }]}
          style={{ marginTop: 16, marginBottom: 0 }}
        >
          <Select style={{ width: 160 }}>
            <Select.Option value={1}>{t(p("usage"))}</Select.Option>
            <Select.Option
              value={2}
              disabled={!accountStorageQuotaEnabled}
              title={!accountStorageQuotaEnabled ? t(p("quotaModeRequiresAccountStorageQuota")) : undefined}
            >
              {t(p("quota"))}
            </Select.Option>
          </Select>
        </Form.Item>

        <Divider />

        <FormHeader>
          <span>{t(p("startValue"))}</span>
          <span />
          <span>{t(p("endValue"))}</span>
          <span>{t(p("unitPrice"))}</span>
          <span />
        </FormHeader>

        <Form.List name="tiers">
          {(fields, { add }) => (
            <>
              {fields.map((field) => (
                <TierRow key={field.key}>
                  <Form.Item
                    name={[field.name, "startSize"]}
                    rules={[{ required: true, message: t(p("required")) }]}
                    className="storage-billing-tier-form-item"
                  >
                    <InputNumber
                      min={0}
                      step={1}
                      addonAfter={renderUnitSelect(field.name)}
                      style={{ width: "100%" }}
                      disabled
                    />
                  </Form.Item>
                  <Typography.Text className="storage-billing-tier-separator" type="secondary">-</Typography.Text>
                  <Form.Item
                    name={[field.name, "endSize"]}
                    rules={[({ getFieldValue }) => ({
                      validator: async (_, value) => {
                        if (value == null) return;
                        const startSize = getFieldValue(["tiers", field.name, "startSize"]);
                        if (startSize != null && value <= startSize) {
                          throw new Error(t(p("endMustGreaterThanStart")));
                        }
                      },
                    })]}
                    className="storage-billing-tier-form-item"
                  >
                    <InputNumber
                      min={0}
                      step={1}
                      placeholder={t("common.noLimit")}
                      addonAfter={renderUnitSelect(field.name)}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, "pricePerTbPerDay"]}
                    rules={[{ required: true, message: t(p("required")) }]}
                    className="storage-billing-tier-form-item"
                  >
                    <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
                  </Form.Item>
                  {fields.length > 1 ? (
                    <RemoveTierBtn onClick={() => {
                      const currentTiers = [...(form.getFieldValue("tiers") || [])] as StoragePriceTierFormValue[];
                      const nextTiers = currentTiers.filter((_, index) => index !== field.name);
                      normalizeTierStarts(nextTiers);
                      form.setFieldsValue({ tiers: nextTiers });
                    }}>
                      <RemoveTierIcon />
                    </RemoveTierBtn>
                  ) : <span />}
                </TierRow>
              ))}
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  const currentTiers = form.getFieldValue("tiers") || [];
                  const lastTier = currentTiers[currentTiers.length - 1];
                  if (lastTier && (lastTier.endSize === undefined || lastTier.endSize === null)) {
                    message.warning(t(p("setLastTierEndFirst")));
                    return;
                  }
                  add({
                    startSize: lastTier?.endSize ?? 0,
                    endSize: undefined,
                    unit: lastTier?.unit ?? "TB",
                    pricePerTbPerDay: 0,
                  });
                }}
              >
                {t(p("add"))}
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export const StorageBillingTable: React.FC<Props> = ({
  data, loading, reload, tenantName, canEdit,
}) => {

  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const { publicStorageConfigs } = useStore(ClusterInfoStore);

  const [expandedStorageIds, setExpandedStorageIds] = useState<Set<string>>(new Set());
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);

  const tableRows = buildTableRows(data, expandedStorageIds);
  const hasExpandableRows = tableRows.some((row) => row.kind === "active" && row.hasHistory);
  const useAdaptiveWidth = !canEdit && !hasExpandableRows;
  const editingActiveItem = editingStorageId
    ? data.find((item) => item.storageId === editingStorageId)?.activeItem
    : undefined;

  const toggleExpand = (storageId: string) => {
    setExpandedStorageIds((prev) => {
      const next = new Set(prev);
      if (next.has(storageId)) {
        next.delete(storageId);
      } else {
        next.add(storageId);
      }
      return next;
    });
  };

  const columns = [
    ...(hasExpandableRows ? [{
      title: "",
      key: "expand",
      width: 74,
      onCell: (row: TableRow) => ({
        rowSpan: row.kind === "active" && row.tierIndex === 0
          ? row.tierTotal
          : row.kind === "historyHeader"
            ? row.historyBlockSize
            : 0,
        className: row.kind !== "active"
          ? "storage-billing-history-side-cell storage-billing-expand-cell"
          : "storage-billing-expand-cell",
      }),
      render: (_: any, row: TableRow) => {
        if (row.kind !== "active") return null;
        if (!row.hasHistory) return null;
        const expanded = expandedStorageIds.has(row.storageId);
        return (
          <Tooltip title={expanded ? t(p("collapseHistory")) : t(p("expandHistory"))}>
            <Button
              type="text"
              icon={expanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />}
              onClick={() => toggleExpand(row.storageId)}
            />
          </Tooltip>
        );
      },
    }] : []),
    {
      title: t(p("fileSystemTitle")),
      key: "storageId",
      width: useAdaptiveWidth ? undefined : 180,
      onCell: (row: TableRow) => ({
        rowSpan: row.kind === "active" && row.tierIndex === 0
          ? row.tierTotal
          : row.kind === "historyHeader"
            ? row.historyBlockSize
            : 0,
        className: row.kind !== "active" ? "storage-billing-history-side-cell" : undefined,
      }),
      render: (_: any, row: TableRow) =>
        row.kind === "active"
          ? getStorageDisplayName(row.storageId, languageId, publicStorageConfigs)
          : null,
    },
    {
      title: t(p("billingId")),
      dataIndex: "id",
      key: "id",
      width: useAdaptiveWidth ? undefined : 180,
      onCell: (row: TableRow) => ({
        rowSpan: row.kind === "historyHeader"
          ? 1
          : row.tierIndex === 0
            ? row.tierTotal
            : 0,
      }),
      render: (_: any, row: TableRow) => {
        if (row.kind === "historyHeader") return t(p("historyBillingId"));
        return row.isSet ? formatBillingId(row.id) : "-";
      },
    },
    {
      title: t(p("billingMode")),
      key: "billingMode",
      width: useAdaptiveWidth ? undefined : 180,
      onCell: (row: TableRow) => ({
        rowSpan: row.kind === "historyHeader"
          ? 1
          : row.tierIndex === 0
            ? row.tierTotal
            : 0,
      }),
      render: (_: any, row: TableRow) => {
        if (row.kind === "historyHeader") return t(p("billingMode"));
        return row.isSet ? billingModeText(row.billingMode, t) : "-";
      },
    },
    {
      title: t(p("unitPrice")),
      key: "price",
      width: useAdaptiveWidth ? undefined : 420,
      render: (_: any, row: TableRow) => {
        if (row.kind === "historyHeader") return t(p("unitPrice"));
        if (!row.isSet) return "-";
        return renderPriceCell(row.rangeText, row.pricePerTbPerDay);
      },
    },
    {
      title: t(p("effectiveDate")),
      key: "createTime",
      width: useAdaptiveWidth ? undefined : 317,
      onCell: (row: TableRow) => ({
        rowSpan: row.kind === "historyHeader"
          ? 1
          : row.tierIndex === 0
            ? row.tierTotal
            : 0,
        colSpan: row.kind !== "active" && canEdit ? 2 : 1,
      }),
      render: (_: any, row: TableRow) => {
        if (row.kind === "historyHeader") return t(p("validPeriod"));
        if (row.kind === "history") {
          return t(p("timeRange"), [
            formatDateTime(row.createTime),
            row.validEndTime ? formatDateTime(row.validEndTime) : "-",
          ]);
        }
        return row.createTime !== "-" ? formatDateTime(row.createTime) : "-";
      },
    },
    ...(canEdit ? [{
      title: t("common.operation"),
      key: "action",
      width: 215,
      onCell: (row: TableRow) => ({
        rowSpan: row.kind === "active" && row.tierIndex === 0 ? row.tierTotal : 0,
        colSpan: row.kind === "active" ? 1 : 0,
      }),
      render: (_: any, row: TableRow) => (
        row.kind === "active" ? (
          <Button type="link" onClick={() => setEditingStorageId(row.storageId)}>
            {t("common.set")}
          </Button>
        ) : null
      ),
    }] : []),
  ];

  return (
    <TableContainer>
      <Table
        dataSource={tableRows}
        columns={columns as any}
        rowKey="key"
        loading={loading}
        pagination={false}
        size="middle"
        bordered
        scroll={useAdaptiveWidth ? undefined : { x: "max-content" }}
        rowClassName={(row) => row.kind === "historyHeader" ? "storage-billing-history-header" : ""}
      />

      {editingStorageId && (
        <SetPriceModal
          open={true}
          onClose={() => setEditingStorageId(null)}
          storageId={editingStorageId}
          activeItem={editingActiveItem}
          tenantName={tenantName}
          reload={reload}
        />
      )}
    </TableContainer>
  );
};
