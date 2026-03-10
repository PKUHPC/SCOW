"use client";

import { Cluster } from "@scow/config/build/type";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { getCurrentLangTextArgs } from "@scow/lib-web/build/utils/systemLanguage";
import { keepPreviousData } from "@tanstack/react-query";
import { App, Button, Divider, Form, Space, Table } from "antd";
import React, { useEffect, useState } from "react";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { ModalButton } from "src/components/ModalLink";
import { AssignedDetailsDrawer } from "src/components/pageComponents/AssignedDetailsDrawer";
import { ClusterAssignmentModal } from "src/components/pageComponents/ClusterAssignmentModal";
import { PartitionAssignmentModal } from "src/components/pageComponents/PartitionAssignmentModal";
import { I18nDicType } from "src/models/i18n";
import { AssignedInfoSortBy, PartitionOperationType, SortOrder } from "src/models/partition";
import { trpc } from "src/server/trpc/api";
import { AllAssignedInfoSchema,
  AssignedClustersPartitionsSchema } from "src/server/trpc/route/partitions/tenantClusterPartitions";
import { getClusterNames } from "src/utils/checkData";
import { DEFAULT_PAGE_SIZE } from "src/utils/constants";

interface Props {
  operationType: PartitionOperationType;
  tenantName?: string;
  language: I18nDicType;
  languageId: string;
}

interface FilterForm {
  // 账户名或租户名
  name: string | undefined;
  // 账户拥有者ID或姓名
  ownerIdOrName: string | undefined;
}

export const PartitionManagementTable: React.FC<Props> = ({
  operationType, tenantName, language, languageId }) => {

  const { message } = App.useApp();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<AssignedInfoSortBy | undefined>();
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>();
  // const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState<FilterForm>(() => ({
    name: undefined,
    ownerIdOrName: undefined,
  }));
  const [noPartitionClusterNames, setNoPartitionClusterNames] = useState<string[]>([]);

  // 获取当前在线集群
  const { data: currentClustersData,
    refetch: currentClustersRefetch,
    isFetching: currentClustersIsFetching,
    error: currentClustersError,
  } = trpc.misServer.currentClusters.useQuery();

  useEffect(() => {
    if (currentClustersError) {
      message.error(language.globalMessage.currentClustersNotFoundError);
    }
  }, [currentClustersError]);

  // 仅在平台管理的租户授权时启用
  const tenantsQuery =
      trpc.partitions.tenantsAssignedDetails.useQuery({
        page,
        pageSize,
        sortBy,
        sortOrder,
        searchTenantText: query.name,
      },
      {
        enabled: operationType === PartitionOperationType.TENANT_OPERATION,
        placeholderData: keepPreviousData,
      });

  // 平台管理下租户授权分区页面是否有获取分区异常的数据
  useEffect(() => {
    const tenantNoPartitionClusters = tenantsQuery.data?.noPartitionClusterIds;
    if (tenantNoPartitionClusters?.length && tenantNoPartitionClusters.length > 0 && currentClustersData) {
      const missingPartitionClusters = getClusterNames(
        tenantNoPartitionClusters, currentClustersData?.results, languageId);
      setNoPartitionClusterNames(missingPartitionClusters);
      message.error(
        getCurrentLangTextArgs(language.globalMessage.partitionsNotFound, [missingPartitionClusters.join(", ")]));
    }
  }, [tenantsQuery.data]);

  useEffect(() => {
    if (tenantsQuery.error) {
      message.error(`${language.clusterPartitionManagement.common.tenantsAssignedInfoFetchFailed}`
        + ` ${tenantsQuery.error.message}`);
    }
  }, [tenantsQuery.error]);

  // 仅在租户管理的账户授权时启用
  const accountsQuery =
      trpc.partitions.accountsAssignedDetails.useQuery({
        tenantName: tenantName ?? "",
        page,
        pageSize,
        sortBy,
        sortOrder,
        searchAccountText: query.name,
        searchOwnerText: query.ownerIdOrName,
      }, {
        enabled: operationType === PartitionOperationType.ACCOUNT_OPERATION && !!tenantName,
        placeholderData: keepPreviousData,
      });


  // 租户管理下账户授权分区页面判断是否有获取分区异常的数据
  // 在租户已授权集群下比较
  useEffect(() => {
    const accountNoPartitionClusters = accountsQuery.data?.noPartitionClusterIds;

    if (accountNoPartitionClusters?.length && accountNoPartitionClusters.length > 0
      && currentClustersData) {
      const missingPartitionClusters = getClusterNames(
        accountNoPartitionClusters, currentClustersData?.results, languageId);
      setNoPartitionClusterNames(missingPartitionClusters);
      message.error(
        getCurrentLangTextArgs(language.globalMessage.partitionsNotFound, [missingPartitionClusters.join(", ")]));
    }
  }, [accountsQuery.data, currentClustersData]);

  useEffect(() => {
    if (accountsQuery.error) {
      message.error(`${language.clusterPartitionManagement.common.accountsAssignedInfoFetchFailed}`
        + ` ${accountsQuery.error.message}`);
    }
  }, [accountsQuery.error]);

  const currentQuery = operationType === PartitionOperationType.ACCOUNT_OPERATION ? accountsQuery : tenantsQuery;
  const data = currentQuery.data?.items ?? [];
  const total = currentQuery.data?.total ?? 0;
  const initialLoading = currentQuery.isLoading;
  const isFetching = currentQuery.isFetching && !currentQuery.isLoading;

  const handleReload = () => {
    currentQuery.refetch();
    currentClustersRefetch();
  };

  return (
    <div>
      <ClusterPartitionInfoTable
        data={data}
        total={total}
        isLoading={(initialLoading || isFetching)}
        reload={() => handleReload()}
        operationType={operationType}
        languageId={languageId}
        language={language}
        currentClustersFetching={currentClustersIsFetching}
        currentClustersData={currentClustersData?.results}
        noPartitionClusterNames={noPartitionClusterNames}
        page={page}
        pageSize={pageSize}
        query={query}
        onPageChange={(newPage) => {
          setPage(newPage);
        }}
        onPageSizeChange={(newPageSize) => {
          setPageSize(newPageSize);
          setPage(1);
        }}
        onSortChange={(field, order) => {
          setSortBy(field);
          setSortOrder(order);
          setPage(1);
        }}
        onSearchChange={(text: string | undefined , ownerText: string | undefined) => {
          setQuery({ name: text, ownerIdOrName: ownerText });
          setPage(1);
        }}
      />
    </div>
  );
};

interface ClusterPartitionManagementInfoTableProps {
  data: AllAssignedInfoSchema[];
  total: number;
  isLoading: boolean;
  reload: () => void;
  operationType: PartitionOperationType;
  languageId: string;
  language: I18nDicType;
  currentClustersData?: Cluster[];
  currentClustersFetching: boolean;
  noPartitionClusterNames: string[];
  page: number;
  pageSize: number;
  query: FilterForm;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (field?: AssignedInfoSortBy, order?: SortOrder) => void;
  onSearchChange: (text: string | undefined, ownerText: string | undefined) => void;
}

const ClusterPartitionInfoTable: React.FC<ClusterPartitionManagementInfoTableProps> = ({
  data,
  total,
  isLoading,
  reload,
  operationType,
  languageId,
  language,
  currentClustersData,
  currentClustersFetching,
  noPartitionClusterNames,
  page,
  pageSize,
  query,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onSearchChange,
}) => {

  const [form] = Form.useForm<FilterForm>();

  const [previewItem, setPreviewItem] = useState<AllAssignedInfoSchema | undefined>(undefined);
  const [clusterPreviewItem, setClusterPreviewItem] = useState<AllAssignedInfoSchema | undefined>(undefined);
  const [partitionPreviewItem, setPartitionPreviewItem] = useState<AllAssignedInfoSchema | undefined>(undefined);

  const getPreviewAssignedInfo = (
    sourceData?: AllAssignedInfoSchema[],
    tenantName?: string,
    accountName?: string,
  ): AssignedClustersPartitionsSchema | undefined => {

    if (!sourceData) return undefined;

    const found = sourceData.find((x) =>
      accountName
        ? x.tenantName === tenantName && x.accountName === accountName
        : x.tenantName === tenantName,
    );

    return found?.assignedInfo;
  };


  const handleTableChange = (pagination: any, filters: any, sorter: any, extra: any) => {

    // 处理分页
    if (extra.action === "paginate" && pagination) {
      if (pagination.current !== page) {
        onPageChange(pagination.current);
      }
      if (pagination.pageSize !== pageSize) {
        onPageSizeChange(pagination.pageSize);
      }
    }

    // 处理排序
    if (extra.action === "sort" && sorter) {
      if (sorter.order) {
        // 有排序
        let field: AssignedInfoSortBy | undefined;

        // 映射表格列到后端排序字段
        if (sorter.field === "tenantName" || sorter.field === "accountName") {
          field = AssignedInfoSortBy.NAME;
        } else if (sorter.field === "assignedClustersCount") {
          field = AssignedInfoSortBy.ASSIGNED_CLUSTERS_COUNT;
        } else if (sorter.field === "assignedPartitionsCount") {
          field = AssignedInfoSortBy.ASSIGNED_PARTITIONS_COUNT;
        }

        const order = sorter.order === "ascend" ? SortOrder.ASCEND : SortOrder.DESCEND;
        onSortChange(field, order);
      } else {
        // 取消排序
        onSortChange(undefined, undefined);
      }
    }
  };

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={{ name: query.name, ownerIdOrName: query.ownerIdOrName }}
          onFinish={async (values) => {
            onSearchChange(values.name, values.ownerIdOrName);
            onPageChange(1);
          }}
        >
          <Form.Item
            label={operationType === PartitionOperationType.TENANT_OPERATION ?
              language.common.tenant : language.common.account}
            name="name"
          >
            <Input />
          </Form.Item>
          {
            operationType === PartitionOperationType.ACCOUNT_OPERATION && (
              <Form.Item
                label={language.common.accountOwner}
                name="ownerIdOrName"
              >
                <Input placeholder={language.common.searchOwnerText} />
              </Form.Item>
            )
          }
          <Button className="ant-form-item" type="primary" htmlType="submit">{language.common.search}</Button>
        </Form>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        rowKey={(record) => (operationType === PartitionOperationType.ACCOUNT_OPERATION ?
          record.accountName! : record.tenantName)}
        dataSource={data}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          current: page,
          pageSize: pageSize,
          total: total,
        }}
        onChange={handleTableChange}
      >
        {
          operationType === PartitionOperationType.TENANT_OPERATION && (
            <Table.Column<AllAssignedInfoSchema>
              dataIndex="tenantName"
              title={language.common.tenant}
              sorter={true}
            />
          )
        }
        {
          operationType === PartitionOperationType.ACCOUNT_OPERATION && (
            <>
              <Table.Column<AllAssignedInfoSchema>
                dataIndex="accountName"
                title={language.common.account}
                sorter={true}
              />
              <Table.Column<AllAssignedInfoSchema>
                dataIndex="ownerId"
                title={language.common.accountOwner}
                width="25%"
                render={(_, r) => `${r.ownerName}（ID: ${r.ownerId}）`}
              />
            </>
          )
        }
        <Table.Column<AllAssignedInfoSchema>
          dataIndex="assignedClustersCount"
          title={language.clusterPartitionManagement.common.assignedClustersCount}
          width="16%"
          render={(_, r) => r.assignedInfo.assignedClustersCount}
          sorter={true}
        />
        <Table.Column<AllAssignedInfoSchema>
          dataIndex="assignedPartitionsCount"
          title={language.clusterPartitionManagement.common.assignedPartitionsCount}
          width="16%"
          render={(_, r) => r.assignedInfo.assignedPartitionsCount}
          sorter={true}
        />
        <Table.Column<AllAssignedInfoSchema>
          title={language.common.operation}
          width="30%"
          fixed="right"
          render={(_, r) => {

            // 维持上一次模态框选中的账户/租户数据
            return (
              <Space>
                <>
                  <a onClick={() => setClusterPreviewItem(r)}>
                    {language.clusterPartitionManagement.common.assignCluster}
                  </a>
                  <Divider type="vertical" />
                  <a onClick={() => setPartitionPreviewItem(r)}>
                    {language.clusterPartitionManagement.common.assignPartition}
                  </a>
                  <Divider type="vertical" />
                  <a onClick={() => setPreviewItem(r)}>
                    {language.common.detail}
                  </a>
                </>
              </Space>
            );
          }}
        />
      </Table>
      <ClusterAssignmentLink
        externalOpen={clusterPreviewItem !== undefined}
        onToggle={(open) => {
          if (!open) {
            setClusterPreviewItem(undefined);
          }
        }}
        assignedAccountName={clusterPreviewItem?.accountName}
        assignedTenantName={clusterPreviewItem?.tenantName ?? ""}
        accountOwnerId={clusterPreviewItem?.ownerId}
        accountOwnerName={clusterPreviewItem?.ownerName}
        assignedClusters={
          getPreviewAssignedInfo(data,
            clusterPreviewItem?.tenantName,
            clusterPreviewItem?.accountName)?.assignedClusters
         ?? []}
        operationType={operationType}
        reload={reload}
        isCurrentClustersLoading={currentClustersFetching}
        languageId={languageId}
        language={language}
        currentClustersData={currentClustersData}
      />
      <PartitionAssignmentLink
        externalOpen={partitionPreviewItem !== undefined}
        onToggle={(open) => {
          if (!open) {
            setPartitionPreviewItem(undefined);
          }
        }}
        assignedAccountName={partitionPreviewItem?.accountName}
        accountOwnerId={partitionPreviewItem?.ownerId}
        accountOwnerName={partitionPreviewItem?.ownerName}
        assignedTenantName={partitionPreviewItem?.tenantName ?? ""}
        assignedInfo={
          getPreviewAssignedInfo(data,
            partitionPreviewItem?.tenantName,
            partitionPreviewItem?.accountName)
        }
        operationType={operationType}
        reload={reload}
        languageId={languageId}
        language={language}
        currentClustersData={currentClustersData}
        currentClustersDataFetching={currentClustersFetching}
        noPartitionClusterNames={noPartitionClusterNames}
      />
      <AssignedDetailsDrawer
        open={previewItem !== undefined}
        detail={previewItem}
        onClose={() => setPreviewItem(undefined)}
        operationType={operationType}
        language={language}
        languageId={languageId}
        currentClustersData={currentClustersData}
      />
    </div>
  );
};


const ClusterAssignmentLink = ModalButton(ClusterAssignmentModal, { type: "link" });
const PartitionAssignmentLink = ModalButton(PartitionAssignmentModal, { type: "link" });
