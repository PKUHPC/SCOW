import { PlusOutlined } from "@ant-design/icons";
import { Button, Form, Table } from "antd";
import { ColumnsType } from "antd/es/table";
import { useRouter } from "next/router";
import React, { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { DesktopTableActions } from "src/pageComponents/desktop/DesktopTableActions";
import { NewDesktopTableModal } from "src/pageComponents/desktop/NewDesktopTableModal";
import { publicConfig } from "src/utils/config";
import { queryToString } from "src/utils/querystring";

const NewDesktopTableModalButton = ModalButton(NewDesktopTableModal, { type: "primary", icon: <PlusOutlined /> });

interface Props {
}

export type DesktopItem = {
  desktopId: number,
  addr: string,
}

export const DesktopTable: React.FC<Props> = () => {

  const router = useRouter();

  const clusterQuery = queryToString(router.query.cluster);
  const cluster = publicConfig.CLUSTERS.find((x) => x.id === clusterQuery) ?? publicConfig.CLUSTERS[0];

  const { data, isLoading, reload } = useAsync({
    promiseFn: useCallback(async () => {
      // List all desktop
      const result = await api.listDesktops({ query: { cluster: cluster.id } });

      return result.displayId.map((x) => ({ desktopId: x, addr: result.node }));

    }, [cluster]),
  });

  const columns: ColumnsType<DesktopItem> = [
    {
      title: "桌面ID",
      dataIndex: "desktopId",
      key: "desktopId",
      width: "30%",
    },
    {
      title: "地址",
      dataIndex: "addr",
      key: "addr",
      width: "30%",
    },
    {
      title: "操作",
      key: "action",
      width: "20%",
      render: (_, record) => (
        <DesktopTableActions cluster={cluster} reload={reload} record={record} />
      ),
    },
  ];
  return (
    <div>
      <FilterFormContainer>
        <Form layout="inline">
          <Form.Item label="集群">
            <SingleClusterSelector
              value={cluster}
              onChange={(x) => {
                router.push({ query: { cluster: x.id } });
              }}
            />
          </Form.Item>
          <Form.Item>
            <Button onClick={reload} loading={isLoading}>
              刷新
            </Button>
          </Form.Item>
          <Form.Item>
            <NewDesktopTableModalButton reload={reload} cluster={cluster}>
              新建桌面
            </NewDesktopTableModalButton>
          </Form.Item>
        </Form>
      </FilterFormContainer>
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record) => record.desktopId}
        loading={isLoading}
        pagination={false}
      />
    </div>
  );
};

