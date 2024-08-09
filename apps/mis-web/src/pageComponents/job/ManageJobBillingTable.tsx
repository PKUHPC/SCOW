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

import { MinusCircleOutlined, PlusCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { numberToMoney } from "@scow/lib-decimal";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { Money } from "@scow/protos/build/common/money";
import { App, Form, Input, InputNumber, Modal, Popover, Select, Space, Table, Tooltip } from "antd";
import React, { useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { AmountStrategyDescriptionsItem } from "src/components/AmonutStrategyDescriptionsItem";
import { CommonModalProps, ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AmountStrategy, getAmountStrategyAlgorithmDescriptions,
  getAmountStrategyDescription,
  getAmountStrategyDescriptions, getAmountStrategyText } from "src/models/job";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";
import { moneyToString } from "src/utils/money";

interface Props {
  data?: {
    activeItems: BillingItemType[],
    historyItems: BillingItemType[],
    nextId: string,
  };
  loading?: boolean;
  tenant?: string;
  reload: () => void;
}

export interface BillingItemType {
  cluster: string;
  partition: string;
  qos: string;
  tenantName?: string;

  priceItem?: {
    itemId: string;
    price: Money;
    amountStrategy: string,
  }
}

const customAmountStrategiesIdToName = {};
const customAmountStrategiesIdToDescription = {};
publicConfig.CUSTOM_AMOUNT_STRATEGIES?.forEach((i) => {
  customAmountStrategiesIdToName[i.id] = i.name || i.id;
  customAmountStrategiesIdToDescription[i.id] = i.comment || i.id;
});


const p = prefix("pageComp.job.manageJobBillingTable.");
const pCommon = prefix("common.");

export const ManageJobBillingTable: React.FC<Props> = ({ data, loading, tenant, reload }) => {

  const t = useI18nTranslateToString();

  const AmountStrategyText = getAmountStrategyText(t);
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  return (
    <Table
      dataSource={data?.activeItems}
      bordered
      loading={loading}
      rowKey={(record) => [record.cluster, record.partition, record.qos].join(".")}
      pagination={{
        showSizeChanger: true,
        defaultPageSize: DEFAULT_PAGE_SIZE,
      }}
      expandable={{ expandedRowRender: (record) => {

        return (
          <Table
            dataSource={
              data?.historyItems
                .filter((x) => x.cluster === record.cluster && x.partition === record.partition && x.qos === record.qos)
                .reverse()
            }
            pagination={{
              defaultPageSize: 10,
              hideOnSinglePage: true,
            }}
          >
            <Table.Column title={t(p("itemId"))} dataIndex={["priceItem", "itemId"]} />
            <Table.Column
              title={AmountStrategyText}
              dataIndex={["priceItem", "amountStrategy"]}
              render={(value) => {
                return (
                  <AmountStrategyDescriptionsItem isColContent={true} amount={value} />
                );
              }}
            />
            <Table.Column
              title={t(p("price"))}
              dataIndex={["priceItem", "price"]}
              render={(value) => moneyToString(value)}
            />
            <Table.Column title={t(pCommon("status"))} render={(_) => t(p("abandon"))} />
          </Table>
        );
      },
      showExpandColumn:true,
      expandIcon: ({ expanded, onExpand, record }) =>
        expanded ? (
          <Tooltip title={t(p("notExpanded"))}>
            <MinusCircleOutlined onClick={(e) => onExpand(record, e)} />
          </Tooltip>
        ) : (
          <Tooltip title={t(p("expanded"))}>
            <PlusCircleOutlined onClick={(e) => onExpand(record, e)} />
          </Tooltip>
        ),
      }}
    >
      <Table.ColumnGroup title={(
        <Space>
          {t(p("priceItem"))}
          <Popover title={t(p("text"))}>
            <QuestionCircleOutlined />
          </Popover>
        </Space>
      )}
      >
        <Table.Column
          title={t(pCommon("cluster"))}
          dataIndex={"cluster"}
          render={(cluster) => getClusterName(cluster, languageId, publicConfigClusters)}
        />
        <Table.Column title={t(pCommon("partition"))} dataIndex={"partition"} />
        <Table.Column title="QOS" dataIndex={"qos"} />
      </Table.ColumnGroup>
      <Table.Column title={t(p("itemId"))} dataIndex={["priceItem", "itemId"]} />
      <Table.Column
        title={(
          <AmountStrategyDescriptionsItem isColTitle={true} />
        )}
        dataIndex={["priceItem", "amountStrategy"]}
        render={(value) => {
          return (
            value ?
              (
                <AmountStrategyDescriptionsItem isColContent={true} amount={value} />
              ) : undefined
          );
        }}
      />
      <Table.Column
        title={t(p("price"))}
        dataIndex={["priceItem", "price"]}
        render={(value) => value ? moneyToString(value) : undefined}
      />
      <Table.Column
        title={t(pCommon("status"))}
        render={(record) =>
          record.priceItem ? t(p("executing")) : t(p("unset"))}
      />
      <Table.Column<BillingItemType>
        title={t(pCommon("set"))}
        render={(_, r) => {
          return {
            children: (
              <Space>
                <EditPriceModalLink
                  nextId={data!.nextId}
                  cluster={r.cluster}
                  partition={r.partition}
                  qos={r.qos}
                  reload={reload}
                  tenant={tenant}
                >
                  {t(pCommon("set"))}
                </EditPriceModalLink>
              </Space>
            ),
          };
        }}
      />
    </Table>


  );
};

const EditPriceModal: React.FC<CommonModalProps & {
  nextId: string; cluster: string; partition: string; qos: string; tenant?: string; reload: () => void
}> = ({
  onClose, nextId, cluster, partition, qos, open, tenant, reload,
}) => {

  const t = useI18nTranslateToString();
  const AmountStrategyDescriptions = getAmountStrategyDescriptions(t);
  const AmountStrategyAlgorithmDescriptions = getAmountStrategyAlgorithmDescriptions(t);
  const AmountStrategyText = getAmountStrategyText(t);
  const AmountStrategyDescription = getAmountStrategyDescription(t);

  const { message } = App.useApp();

  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const [form] = Form.useForm<{ price: number; amount: string; description: string }>();
  const [loading, setLoading] = useState(false);

  const onOk = async () => {
    const { amount, description, price } = await form.validateFields();

    setLoading(true);

    await api.addBillingItem({ body: {
      amount, itemId: nextId, path: [cluster, partition, qos].join("."),
      price: numberToMoney(price), description, tenant,
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
    <Modal title={t(p("setPrice"))} open={open} onCancel={onClose} onOk={onOk} destroyOnClose confirmLoading={loading}>
      <Form
        form={form}
      >
        <Form.Item label={t(p("object"))}>
          <strong>{tenant ? (t(pCommon("tenant")) + tenant) : t(pCommon("platform"))}</strong>
        </Form.Item>
        <Form.Item label={t(p("priceItem"))}>
          {t(pCommon("cluster"))} <strong>{getClusterName(cluster, languageId, publicConfigClusters)}</strong>，
          {t(pCommon("partition"))} <strong>{partition}</strong>，QOS <strong>{qos}</strong>
        </Form.Item>
        <Form.Item label={t(p("newItemId"))}>
          <strong>{nextId}</strong>
        </Form.Item>
        <Form.Item
          label={(
            <Space>
              {AmountStrategyText}
              <Popover
                title={AmountStrategyDescription}
                content={(
                  <div>
                    {Object.entries(AmountStrategyAlgorithmDescriptions)
                      .map((value) => <p key={value[0]}>{`${value[0]}: ${value[1]}`}</p>)}
                  </div>
                )}
              >
                <QuestionCircleOutlined />
              </Popover>
            </Space>
          )}
          name="amount"
          rules={[{ required: true }]}
        >
          <Select
            options={
              [...Object.values(AmountStrategy)
                .map((x) => ({ label: AmountStrategyDescriptions[x], value: x })),
              ...(publicConfig.CUSTOM_AMOUNT_STRATEGIES || []).map((i) => ({ label: i.name || i.id, value: i.id })),
              ]}
            dropdownMatchSelectWidth={false}

          />
        </Form.Item>
        <Form.Item label={t(p("price"))} name="price" initialValue={0} rules={[{ required: true }]}>
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
