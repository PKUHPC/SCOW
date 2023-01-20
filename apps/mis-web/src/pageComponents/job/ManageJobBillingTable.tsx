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
import { Money } from "@scow/protos/build/common/money";
import { JobBillingItem } from "@scow/protos/build/server/job";
import { App, Form, Input, InputNumber, Modal, Popover, Select, Space, Table, Tooltip } from "antd";
import React, { useState } from "react";
import { api } from "src/apis";
import { CommonModalProps, ModalLink } from "src/components/ModalLink";
import { AmountStrategy, AmountStrategyAlgorithm, AmountStrategyDescribe } from "src/models/job";
import { moneyToString } from "src/utils/money";

interface Props {
  data?: {activeItems: JobBillingItem[], historyItems: JobBillingItem[]};
  loading?: boolean;
  tenant?: string;
  reload: () => void;
}

interface BillingItemType {
  id: string;
  cluster: string;
  partition: string;
  qos: string;
  tenantName?: string;
  price?: Money;
  amountStrategy: string,
}

const calculateNextId = (data?: JobBillingItem[], tenant?: string) => {
  const currentItemIds = data ? data.filter((x) => x.tenantName === tenant).map((x) => x.id) : [];
  if (!tenant) {
    const nums = currentItemIds.map((x) => parseInt(x)).filter((x) => !isNaN(x));
    return (nums.length === 0 ? 1 : Math.max(...nums) + 1).toString();
  }
  else {
    const flag = tenant + " ";
    const nums = currentItemIds
      .filter((x) => x.startsWith(flag))
      .map((x) => parseInt(x.replace(flag, "")))
      .filter((x) => !isNaN(x));
    return tenant + " " + (nums.length === 0 ? 1 : Math.max(...nums) + 1);
  }
};

const sourceToBillingItemType = (item: JobBillingItem) => {
  const priceItem = item.path.split(".");
  return {
    id: item.id,
    cluster: priceItem[0],
    partition: priceItem[1],
    qos: priceItem[2],
    tenantName: item.tenantName,
    price: item.price,
    amountStrategy: item.amountStrategy,
  } as BillingItemType;
};

export const ManageJobBillingTable: React.FC<Props> = ({ data, loading, tenant, reload }) => {
  const nextId = calculateNextId(data?.activeItems, tenant);

  return (
    <Table
      dataSource={data?.activeItems.map(sourceToBillingItemType)}
      bordered
      loading={loading}
      rowKey="id"
      expandable={{ expandedRowRender: (record) => {
        return (
          <Table 
            dataSource={
              data?.historyItems
                .filter((x) => x.path === [record.cluster, record.partition, record.qos].join("."))
                .map(sourceToBillingItemType)
            }
            pagination={false}
          >
            <Table.Column title="计费价格编号" dataIndex={"id"} />
            <Table.Column
              title={"计费方式"}
              dataIndex={"amountStrategy"}
              render={(value) => {
                return (
                  <Space>
                    {AmountStrategyDescribe[value]}
                    <Popover title={`总量算法: ${AmountStrategyAlgorithm[value]}`}>
                      <QuestionCircleOutlined />
                    </Popover>
                  </Space>
                );
              }}
            />
            <Table.Column title="单价（元）" dataIndex={"price"} render={(value) => moneyToString(value)} />
            <Table.Column title="状态" render={(_) => "已作废"} />
          </Table>
        );
      }, 
      showExpandColumn:true,
      expandIcon: ({ expanded, onExpand, record }) =>
        expanded ? (
          <Tooltip title="收起历史计费项">
            <MinusCircleOutlined onClick={(e) => onExpand(record, e)} />
          </Tooltip>
        ) : (
          <Tooltip title="展开历史计费项">
            <PlusCircleOutlined onClick={(e) => onExpand(record, e)} />
          </Tooltip>
        ),
      }}
    >
      <Table.Column title="计费价格编号" dataIndex={"id"} />
      <Table.ColumnGroup title={(
        <Space>
          {"计费项"}
          <Popover title="集群, 分区, QOS共同组成一个计费项。对计费项可以设定计费方式和单价">
            <QuestionCircleOutlined />
          </Popover>
        </Space>
      )}
      >
        <Table.Column title="集群" dataIndex={"cluster"} />
        <Table.Column title="分区" dataIndex={"partition"} />
        <Table.Column title="QOS" dataIndex={"qos"} />
      </Table.ColumnGroup>
      <Table.Column
        title={(
          <Space>
            {"计费方式"}
            <Popover
              title={"计费方式"}
              content={(
                <div>
                  <p>
                    {Object.entries(AmountStrategyDescribe)
                      .map((value) => <p key={value[0]}>{`${value[1]}(${value[0]})`}</p>)}
                  </p>
                  <a href="https://icode.pku.edu.cn/SCOW/docs/info/mis/business/billing">{"细节请查阅文档"}</a>
                </div>
              )}
            >
              <QuestionCircleOutlined />
            </Popover>
          </Space>
        )}
        dataIndex={"amountStrategy"}
        render={(value) => {
          return (
            <Space>
              {AmountStrategyDescribe[value]}
              <Popover title={`总量算法: ${AmountStrategyAlgorithm[value]}`}>
                <QuestionCircleOutlined />
              </Popover>
            </Space>
          );
        }}
      />
      <Table.Column title="单价（元）" dataIndex={"price"} render={(value) => moneyToString(value)} />
      <Table.Column title="状态" render={(_) => "执行中"} />
      <Table.Column<BillingItemType>
        title="设置"
        render={(_, r) => {
          return {
            children: (
              <Space>
                <EditPriceModalLink 
                  nextId={nextId}
                  cluster={r.cluster} 
                  partition={r.partition} 
                  qos={r.qos} 
                  reload={reload} 
                  tenant={tenant} 
                >
                  设置
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

  const { message } = App.useApp();

  const [form] = Form.useForm<{ price: number; amount: string; description: string }>();
  const [loading, setLoading] = useState(false);

  const onOk = async () => {
    const { amount, description, price } = await form.validateFields();

    setLoading(true);

    await api.addBillingItem({ body: {
      amount, itemId: nextId, path: [cluster, partition, qos].join("."), 
      price: numberToMoney(price), description, tenant,
    } })
      .httpError(409, () => { message.error("此ID已经被使用！"); })
      .then(() => {
        message.success("添加成功！");
        reload();
        onClose();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title="设置计费价格" open={open} onCancel={onClose} onOk={onOk} destroyOnClose confirmLoading={loading}>
      <Form
        form={form}
      >
        <Form.Item label="租户">
          <strong>{tenant ?? "默认价格项"}</strong>
        </Form.Item>
        <Form.Item label="计费路径">
          <strong>{`${cluster}集群, ${partition}分区, ${qos}QOS`}</strong>
        </Form.Item>
        <Form.Item label="计费项ID">
          <strong>{nextId}</strong>
        </Form.Item>
        <Form.Item 
          label={(
            <Space>
              {"计费策略"}
              <Popover
                title={"总量算法"}
                content={(
                  <div>
                    {Object.entries(AmountStrategyAlgorithm)
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
              Object.values(AmountStrategy)
                .map((x) => ({ label: AmountStrategyDescribe[x], value: x }))} 
            placeholder="请选择计费策略"
            dropdownMatchSelectWidth={false}
              
          />
        </Form.Item>
        <Form.Item label="价格（元）" name="price" rules={[{ required: true }]}>
          <InputNumber precision={3} min={0} defaultValue={0} />
        </Form.Item>
        <Form.Item label="备注" name="description">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const EditPriceModalLink = ModalLink(EditPriceModal);
