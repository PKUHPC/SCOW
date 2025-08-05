"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Cluster } from "@scow/config/build/type";
import { getCurrentLangTextArgs,getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Input, Space, Table, Tooltip } from "antd";
import React, { useMemo, useState } from "react";
import { usePublicConfig } from "src/app/publicConfigContext";
import { RemoveDefaultPartitionIcon } from "src/assets/operationIcon";
import { I18nDicType } from "src/models/i18n";
import { ClusterPartition } from "src/models/partition";
import { trpc } from "src/server/trpc/api";
import { DEFAULT_PAGE_SIZE } from "src/utils/constants";

import { SingleClusterSelector } from "../../../components/ClusterSelector";
import { FilterFormContainer } from "../../../components/FilterFormContainer";
import { AddToAccountDefaultPartitionsButton } from "./AddToAccountDefaultPartitionsButton";

interface FilterForm {
  cluster: Cluster | undefined;
  partition: string | undefined;
}

interface AccountDefaultPartitionsProps {
  data: ClusterPartition[] | undefined;
  defaultClusterIds?: string[],
  tenantName?: string;
  isLoading: boolean;
  reload: () => void;
  language: I18nDicType;
  languageId?: string;
}

export const AccountDefaultPartitionsTable: React.FC<AccountDefaultPartitionsProps> = ({
  data, defaultClusterIds, tenantName, isLoading, reload, language, languageId,
}) => {

  const { clusterSortedIdList } = usePublicConfig();

  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FilterForm>();

  const [currentPageNum, setCurrentPageNum] = useState<number>(1);

  const [query, setQuery] = useState<FilterForm>({
    cluster: undefined,
    partition: undefined,
  });

  const { data: currentClustersData,
    refetch: currentClustersRefetch,
    isFetching: currentClustersFetching } = trpc.misServer.currentClusters.useQuery();

  const filteredData = useMemo(() => {
    if (!data || !currentClustersData) return undefined;

    const { cluster, partition } = query;
    const lowerPartition = partition?.toLowerCase();
    const clusterSortedIdMap = Object.fromEntries(
      clusterSortedIdList.map((id, index) => [id, index]),
    );
    return data.filter((x) => {
      const partitionMatch = lowerPartition ? x.partition.toLowerCase().includes(lowerPartition) : true;
      const clusterMatch = cluster?.id ? x.clusterId === cluster.id : true;
      const onlineMatch = currentClustersData.results?.some((currentCluster) => currentCluster.id === x.clusterId);

      return clusterMatch && partitionMatch && onlineMatch;
    }).sort((a, b) => {
      // 使用 clusterSortedIdList 的索引进行排序
      const aIndex = clusterSortedIdMap[a.clusterId] ?? Number.MAX_SAFE_INTEGER;
      const bIndex = clusterSortedIdMap[b.clusterId] ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [data, query, currentClustersData, clusterSortedIdList]);

  const removeFromDefaultPartitionsMutation = trpc.partitions.removeFromAccountDefaultPartitions.useMutation({
    onSuccess() {
      message.success(language.accountDefaultPartitions.removeModal.successMessage);
      form.resetFields();
      reload();
      currentClustersRefetch();
    },
    onError(e) {
      if (e.data?.code === "FORBIDDEN") {
        message.error(language.globalMessage.authFailureMessage);
        return;
      } else if (e.data?.code === "CONFLICT") {
        message.error(e.message);
        return;
      } else {
        message.error(e.message);
      }
    },
  });


  const removerFromDefaultPartitions = async (
    clusterId: string,
    partition: string,
  ) => {

    if (tenantName) {
      await removeFromDefaultPartitionsMutation.mutateAsync({
        clusterId,
        partition,
        tenantName,
      });
    } else {
      message.error(language.globalMessage.tenantNotFound);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: "20px" }}>
        <ExclamationCircleOutlined />
        <span>
          {language.accountDefaultPartitions.explanation}
        </span>
      </Space>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            const { cluster, partition } = await form.validateFields();
            setQuery({ cluster, partition });
            setCurrentPageNum(1);
          }}
        >
          <Form.Item label={language.common.cluster} name="cluster">
            <SingleClusterSelector
              languageId={languageId}
              allowClear={true}
              currentClusters={currentClustersData?.results as Cluster[]}
            />
          </Form.Item>
          <Form.Item name="partition">
            <Input allowClear placeholder={language.common.partitionInputPlaceholder} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{language.common.search}</Button>
          </Form.Item>
        </Form>

        <Space>
          <AddToAccountDefaultPartitionsButton
            defaultPartitions={data}
            defaultClusterIds={defaultClusterIds}
            tenantName={tenantName}
            currentClusters={currentClustersData?.results as Cluster[]}
            refresh={reload}
            language={language}
            languageId={languageId}
          />
        </Space>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={isLoading || currentClustersFetching}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          current: currentPageNum,
          onChange: (page) => setCurrentPageNum(page),
        }}
      >
        <Table.Column<ClusterPartition>
          dataIndex="clusterId"
          title={language.common.cluster}
          render={(_, r) => {
            const cluster = currentClustersData?.results?.find((c) => c.id === r.clusterId);
            const clusterName = getI18nConfigCurrentText(cluster?.name, languageId);
            return clusterName;
          }}
          sorter={(a, b) => a.clusterId.localeCompare(b.clusterId)}
        />
        <Table.Column<ClusterPartition>
          dataIndex="partition"
          title={language.common.partition}
          sorter={(a, b) => a.partition.localeCompare(b.partition)}
        />
        <Table.Column<ClusterPartition>
          title={language.common.operation}
          render={(_, r) => (
            <Space>
              <Button
                type="link"
                onClick={() => {
                  modal.confirm({
                    title: language.accountDefaultPartitions.removeModal.title,
                    icon: <ExclamationCircleOutlined />,
                    content: getCurrentLangTextArgs(language.accountDefaultPartitions.removeModal.content,
                      [tenantName, r.partition]),
                    onOk: async () => {
                      // 移出分区请求
                      await removerFromDefaultPartitions(r.clusterId, r.partition);
                    },
                  });
                }}
              >
                <Tooltip title={language.accountDefaultPartitions.removeModal.title}>
                  <RemoveDefaultPartitionIcon />
                </Tooltip>
              </Button>
            </Space>
          )}
        />
      </Table>
    </div>
  );
};
