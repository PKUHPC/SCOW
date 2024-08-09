/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { numberToMoney } from "@scow/lib-decimal";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, Input, InputNumber, Modal, Select, Space, Table } from "antd";
import { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { JobBillingTableItem } from "src/components/JobBillingTable";
import { CommonModalProps, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AmountStrategy } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { publicConfig } from "src/utils/config";

const p = prefix("pageComp.job.editableJobBillingTable.");
const pCommon = prefix("common.");

const EditPriceModal: React.FC<CommonModalProps & {
  current: JobBillingTableItem["priceItem"]; path: string; tenant?: string; reload: () => void
}> = ({
  current, onClose, path, open, tenant, reload,
}) => {

  const t = useI18nTranslateToString();

  const { message } = App.useApp();

  const [form] = Form.useForm<{ price: number; itemId: string; amount: string; description: string }>();
  const [loading, setLoading] = useState(false);

  const onOk = async () => {
    const { amount, description, itemId, price } = await form.validateFields();

    setLoading(true);

    await api.addBillingItem({ body: {
      amount, itemId, path, price: numberToMoney(price), description, tenant,
    } })
      .httpError(409, () => { message.error(t(p("alreadyUsed"))); })
      .then(() => {
        message.success(t(p("addSuccess")));
        reload();
        onClose();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t(p("edit"))} open={open} onCancel={onClose} onOk={onOk} destroyOnClose confirmLoading={loading}>
      <Form
        form={form}
        initialValues={{
          itemId: current?.itemId,
          amount: current?.amount ?? AmountStrategy.CPUS_ALLOC,
          price: current?.price ?? 0,
          description: "",
        }}
      >
        <Form.Item label={t(pCommon("tenant"))}>
          <strong>{tenant ?? t(p("defaultPrice"))}</strong>
        </Form.Item>
        <Form.Item label={t(p("path"))}>
          <strong>{path}</strong>
        </Form.Item>
        <Form.Item label={t(p("id"))} name="itemId" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label={t(p("strategy"))} name="amount" rules={[{ required: true }]}>
          <Select options={Object.values(AmountStrategy).map((x) => ({ label: x, value: x }))} />
        </Form.Item>
        <Form.Item label={t(p("price"))} name="price" rules={[{ required: true }]}>
          <InputNumber precision={publicConfig.CHARGE_PRECISION} min={0} />
        </Form.Item>
        <Form.Item label={t(pCommon("comment"))} name="description">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const EditPriceModalLink = ModalLink(EditPriceModal);

interface Props {
  data?: JobBillingTableItem[]
  loading?: boolean;
  tenant?: string;
  reload: () => void;
}

export const EditableJobBillingTable: React.FC<Props> = ({ data, loading, tenant, reload }) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const clusterTotalQosCounts = data?.length ?
    data.reduce((totalQosCounts: Record<string, number>, item) => {
      const { cluster } = item;
      if (!totalQosCounts[cluster]) {
        totalQosCounts[cluster] = 1;
      } else {
        totalQosCounts[cluster]++;
      }
      return totalQosCounts;
    }, {}) : {};

  const columns: ColumnsType<JobBillingTableItem> = [
    { dataIndex: "cluster", title: t(pCommon("cluster")), key: "index", render: (_, r) => ({
      children: getI18nConfigCurrentText(publicConfigClusters[r.cluster]?.name, languageId) ?? r.cluster,
      props: { rowSpan: r.clusterItemIndex === 0 && clusterTotalQosCounts ? clusterTotalQosCounts[r.cluster] : 0 },
    }) },
    { dataIndex: "partition", title: t(p("name")), key: "index", render: (_, r) => ({
      children: r.partition,
      props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
    }) },
    { dataIndex: "nodes", title: t(p("nodes")), key: "index", render: (_, r) => ({
      children: r.nodes,
      props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
    }) },
    { dataIndex: "cores", title: t(p("cores")), key: "index", render: (_, r) => ({
      children: r.cores,
      props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
    }) },
    { dataIndex: "gpus", title: t(p("gpus")), key: "index", render: (_, r) => ({
      children: r.gpus,
      props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
    }) },
    { dataIndex: "mem", title: t(p("memory")), key: "index", render: (_, r) => ({
      children: r.mem,
      props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
    }) },
    { dataIndex: "qos", title: "QOS", key: "index", render: (_, r) => ({
      children: r.qos,
    }) },
    { dataIndex: "priceItem", title: t(p("now")), key: "index", render: (_, r) => ({
      children: r.priceItem
        ? `${r.priceItem.itemId} (${r.priceItem.price}, ${r.priceItem.amount})`
        : t(p("unset")),
    }) },
  ];

  return (
    <Table
      dataSource={data}
      columns={[
        ...columns,
        { dataIndex: "price", title: t(pCommon("set")), key: "index", render: (_, r) => {
          return {
            children: (
              <Space>
                <EditPriceModalLink current={r.priceItem} path={r.path} reload={reload} tenant={tenant}>
                  {t(pCommon("set"))}
                </EditPriceModalLink>
              </Space>
            ),
          };
        } },
      ]}
      scroll={{ x: 800 }}
      size="middle"
      bordered
      pagination={false}
      loading={loading}
    />
  );
};

