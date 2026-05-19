import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Table } from "antd";
import { ColumnsType } from "antd/es/table";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { styled } from "styled-components";

import { AmountStrategyDescriptionsItem } from "./AmonutStrategyDescriptionsItem";

const TableContainer = styled.div`
  .ant-table-content {
    max-height: 500px;
    overflow-y: auto !important;
  }
`;

export interface JobBillingTableItem {
  index: number;

  cluster: string;
  clusterItemIndex: number;

  priceItem?: {
    itemId: string;
    price: string;
    amount: string;
  };

  partition: string;
  partitionCount: number;

  partitionItemIndex: number;

  qos: string;
  qosCount: number;
  nodes: number;
  mem: number;
  cores: number;
  gpus: number;
  path: string;
  comment?: string;
}

interface Props {
  data: JobBillingTableItem[] | undefined;
  loading?: boolean;
  isUserPartitionsPage?: boolean;
}

const p = prefix("component.others.");
const pCommon = prefix("common.");

export const JobBillingTable: React.FC<Props> = ({ data, loading, isUserPartitionsPage }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { activatedClusters } = useStore(ClusterInfoStore);

  const clusterTotalQosCounts = data?.length
    ? data.reduce((totalQosCounts: Record<string, number>, item) => {
        const { cluster } = item;
        if (!totalQosCounts[cluster]) {
          totalQosCounts[cluster] = 1;
        } else {
          totalQosCounts[cluster]++;
        }
        return totalQosCounts;
      }, {})
    : {};

  const columns: ColumnsType<JobBillingTableItem> = [
    ...(isUserPartitionsPage
      ? []
      : [
          {
            dataIndex: "cluster",
            title: t(pCommon("cluster")),
            key: "index",
            render: (_, r) => ({
              children: getI18nConfigCurrentText(activatedClusters[r.cluster]?.name, languageId) ?? r.cluster,
              props: {
                rowSpan: r.clusterItemIndex === 0 && clusterTotalQosCounts ? clusterTotalQosCounts[r.cluster] : 0,
              },
            }),
          },
        ]),
    {
      dataIndex: "partition",
      title: t(p("partitionFullName")),
      key: "index",
      render: (_, r) => ({
        children: r.partition,
        props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
      }),
    },
    {
      dataIndex: "nodes",
      title: t(p("nodes")),
      key: "index",
      render: (_, r) => ({
        children: r.nodes,
        props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
      }),
    },
    {
      dataIndex: "cores",
      title: t(p("cores")),
      key: "index",
      render: (_, r) => ({
        children: r.cores / r.nodes,
        props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
      }),
    },
    {
      dataIndex: "gpus",
      title: t(p("gpus")),
      key: "index",
      render: (_, r) => ({
        children: r.gpus / r.nodes,
        props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
      }),
    },
    {
      dataIndex: "mem",
      title: t(p("mem")),
      key: "index",
      render: (_, r) => ({
        children: r.mem / r.nodes,
        props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
      }),
    },
    {
      dataIndex: "qos",
      title: "QOS",
      key: "index",
      render: (_, r) => ({
        children: r.qos,
      }),
    },
    {
      dataIndex: "price",
      title: t(p("price")),
      key: "index",
      render: (_, r) => ({
        children: r.priceItem?.price ?? t(p("notDefined")),
      }),
    },
    {
      dataIndex: "amount",
      title: <AmountStrategyDescriptionsItem isColTitle={true} />,
      key: "index",
      render: (_, r) => ({
        children: r.priceItem?.amount ? (
          <AmountStrategyDescriptionsItem isColContent={true} amount={r.priceItem?.amount} />
        ) : (
          t(p("notDefined"))
        ),
      }),
    },
    {
      dataIndex: "comment",
      title: t(p("description")),
      key: "index",
      render: (_, r) => ({
        children: r.comment,
        props: { rowSpan: r.partitionItemIndex === 0 ? r.qosCount : 0 },
      }),
    },
  ];

  return (
    <TableContainer>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="index"
        scroll={{ x: 800 }}
        size="middle"
        bordered
        pagination={false}
        loading={loading}
      />
    </TableContainer>
  );
};
