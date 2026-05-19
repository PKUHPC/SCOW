import { QuestionCircleOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { formatBytesToGB, formatBytesToString } from "@scow/lib-web/build/utils/sizeFormatter";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Result, Space, Table, Tooltip } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { QuotaSortFieldType, QuotaSortOrderType } from "src/models/storage";
import { UserDefaultQuotaChangeModal } from "src/pageComponents/storage/UserDefaultQuotaChangeModal";
import { UserQuotaChangeModal } from "src/pageComponents/storage/UserQuotaChangeModal";
import { type GetTenantQuotaSchema, UserQuotaInfo } from "src/pages/api/storage/getTenantQuota";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster, getSortedClusterValues } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface FilterForm {
  idOrName: string;
  cluster: Cluster | undefined;
}

interface SortInfo {
  field: QuotaSortFieldType | undefined;
  order: QuotaSortOrderType | undefined;
}

interface Props {}

const p = prefix("pageComp.storage.tenantStorageManangerTable.");
const pCommon = prefix("common.");

// 由于查询文件系统非常慢，所以默认一次只取 10 个用户数据
// 不要使用 import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
const STORAGE_DEFAULT_PAGE_SIZE = 10;

export const TenantStorageManagerTable: React.FC<Props> = () => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

  const [sortInfo, setSortInfo] = useState<SortInfo>({ field: undefined, order: undefined });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserQuotaInfo[]>([]);

  const getTenantAssignedClusterIds = useCallback(async () => {
    if (publicConfig.SCOW_RESOURCE_ENABLED) {
      const tenantAssignedClusterPartitions = await api.getTenantAssignedClustersAndPartitions({});
      return Object.keys(tenantAssignedClusterPartitions.assignedClusterPartitions);
    }
    return undefined;
  }, []);

  const { data: availableClusterIds, isLoading: availableClusterIdsLoading } = useAsync({
    promiseFn: getTenantAssignedClusterIds,
    skip: !publicConfig.SCOW_RESOURCE_ENABLED,
  });

  const { publicConfigClusters, clusterSortedIdList, activatedClusters, fullClusterConfigs } =
    useStore(ClusterInfoStore);
  const sortedClusters = useMemo(
    () =>
      getSortedClusterValues(publicConfigClusters, clusterSortedIdList).filter((x) => {
        return (
          (publicConfig.SCOW_RESOURCE_ENABLED ? availableClusterIds?.includes(x.id) : true) &&
          Object.keys(activatedClusters).includes(x.id) &&
          fullClusterConfigs[x.id].storage?.enabled
        );
      }),
    [availableClusterIds, activatedClusters, fullClusterConfigs],
  );

  const [query, setQuery] = useState<FilterForm>(() => {
    if (sortedClusters.length === 0) {
      return {
        idOrName: "",
        cluster: undefined,
      };
    }
    return {
      idOrName: "",
      cluster: sortedClusters[0],
    };
  });
  const [form] = Form.useForm<FilterForm>();

  useEffect(() => {
    setQuery({ ...query, cluster: sortedClusters[0] });
  }, [sortedClusters]);

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: STORAGE_DEFAULT_PAGE_SIZE });

  const storageConfig = useMemo(() => {
    if (!query.cluster) return undefined;
    return fullClusterConfigs[query.cluster.id].storage;
  }, [query.cluster]);

  const promiseFn = useCallback(async () => {
    if (!storageConfig) {
      // 如果是所有集群都未开启存储管理则无需提示没有存储配置
      if (sortedClusters.length > 0) message.error(t(p("notFoundStorageConfig")));
      return;
    }
    if (!query.cluster || sortedClusters.length <= 0) return;

    const queryParams: any = {
      ...query,
      cluster: query.cluster.id,
      path: storageConfig.paths[0],
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
    };

    // 仅在用户主动选择排序时才包含排序字段参数
    if (sortInfo.field && sortInfo.order) {
      queryParams.sortField = sortInfo.field;
      queryParams.sortOrder = sortInfo.order;
    }

    return await api.getTenantQuota({ query: queryParams });
  }, [pageInfo, query, sortInfo]);

  const { data, isLoading, reload } = useAsync({ promiseFn, skip: !query.cluster });

  return (
    <>
      {!isLoading && !availableClusterIdsLoading && sortedClusters.length === 0 ? (
        <Result title={t(p("clusterNotEnabledStorageManager"))} />
      ) : (
        <div>
          <FilterFormContainer>
            <Form<FilterForm>
              form={form}
              initialValues={query}
              onFinish={async () => {
                const currentQuery = await form.validateFields();
                setQuery({
                  ...query,
                  idOrName: currentQuery.idOrName,
                });
                setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
                setSortInfo({ field: undefined, order: undefined });
              }}
            >
              <FilterFormTabs
                onChange={(clusterId) => {
                  const cluster = sortedClusters.find((cluster) => cluster.id === clusterId);
                  if (cluster) {
                    setQuery({
                      ...query,
                      cluster,
                    });
                    setSortInfo({ field: undefined, order: undefined });
                  }
                }}
                tabs={sortedClusters.map((cluster) => ({
                  title: getI18nConfigCurrentText(cluster.name, languageId),
                  key: cluster.id,
                  node: (
                    <>
                      <Space>
                        <Form.Item label={t(pCommon("user"))} name="idOrName">
                          <Input placeholder={t(pCommon("idOrName"))} />
                        </Form.Item>
                        <Button type="primary" htmlType="submit">
                          {t(pCommon("search"))}
                        </Button>
                      </Space>
                    </>
                  ),
                }))}
              />
            </Form>
          </FilterFormContainer>
          <StorageInfoTable
            reload={reload}
            data={data}
            isLoading={isLoading || availableClusterIdsLoading}
            pageInfo={pageInfo}
            setPageInfo={setPageInfo}
            cluster={query.cluster}
            replicaExist={query.cluster ? fullClusterConfigs[query.cluster.id].storage?.replicaExist : false}
            path={storageConfig?.paths[0] || ""}
            sortInfo={sortInfo}
            setSortInfo={setSortInfo}
            selectedRowKeys={selectedRowKeys}
            setSelectedRowKeys={setSelectedRowKeys}
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
          />
        </div>
      )}
    </>
  );
};

interface StorageInfoTableProps {
  data: Static<(typeof GetTenantQuotaSchema)["responses"]["200"]> | undefined;
  pageInfo: PageInfo;
  setPageInfo?: (info: PageInfo) => void;
  isLoading: boolean;
  reload: () => void;
  cluster: Cluster | undefined;
  replicaExist: boolean | undefined;
  path: string;
  sortInfo: SortInfo;
  setSortInfo: (info: SortInfo) => void;
  selectedRowKeys: string[];
  setSelectedRowKeys: (keys: string[]) => void;
  selectedUsers: UserQuotaInfo[];
  setSelectedUsers: (users: UserQuotaInfo[]) => void;
}

const StorageInfoTable: React.FC<StorageInfoTableProps> = ({
  data,
  pageInfo,
  setPageInfo,
  isLoading,
  reload,
  cluster,
  replicaExist,
  path,
  sortInfo,
  setSortInfo,
  selectedRowKeys,
  setSelectedRowKeys,
  selectedUsers,
  setSelectedUsers,
}) => {
  const t = useI18nTranslateToString();

  const { message } = App.useApp();

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ lastSyncTime?: string }>({});
  const [batchQuotaModalOpen, setBatchQuotaModalOpen] = useState(false);

  const handleTableChange = (_, __, sorter) => {
    // 只有当 sorter 对象存在且有有效的 field 和 order 时才更新排序状态
    // 避免 Ant Design Table 组件的默认行为导致意外的排序状态设置
    if (sorter?.field && sorter.order) {
      setSortInfo({
        field: sorter.field,
        order: sorter.order,
      });
    } else {
      // 如果没有有效的排序信息，重置为 undefined
      setSortInfo({
        field: undefined,
        order: undefined,
      });
    }
  };

  // 获取同步信息
  const fetchSyncInfo = useCallback(async () => {
    if (!cluster) return;
    try {
      const response = await api.getStorageSyncInfo({ query: { cluster: cluster.id, path } });
      setSyncInfo(response);
    } catch (error) {
      console.error("Failed to fetch sync info:", error);
    }
  }, [cluster, path]);

  // 同步存储数据
  const handleSyncStorage = async () => {
    if (!cluster) return;
    setSyncLoading(true);
    try {
      await api.syncTenantUsersStorageUsage({ body: { cluster: cluster.id, path } });
      message.success(t(p("syncSuccess")));
      reload();
      fetchSyncInfo();
    } catch {
      message.error(t(p("syncFailed")));
    } finally {
      setSyncLoading(false);
    }
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: string[], rows: UserQuotaInfo[]) => {
      setSelectedRowKeys(keys);
      setSelectedUsers(rows);
    },
  };

  // 初始化时获取同步信息
  useEffect(() => {
    fetchSyncInfo();
  }, [fetchSyncInfo]);

  return (
    <>
      <TableTitle justify="space-between">
        {data ? (
          <>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span>
                <Space>
                  {t(p("totalStorage"))}
                  <span>{formatBytesToString(data.totalStorageBytes)}</span>
                </Space>
              </span>
              <Divider type="vertical" />
              <span>
                <Space>
                  {t(p("remainingStorage"))}
                  <span>{formatBytesToString(data.remainingStorageBytes)}</span>
                </Space>
              </span>
              <Divider type="vertical" />
              <Space>
                <span>
                  <Space>
                    {t(p("userDefaultQuota"))}
                    <span>{formatBytesToGB(data.userDefaultQuotaBytes).toFixed(2) + " GB"}</span>
                  </Space>
                </span>
                {cluster && (
                  <ChangeDefaultQuotaLink
                    reload={reload}
                    cluster={cluster}
                    path={path}
                    defaultQuotaBytes={data.userDefaultQuotaBytes}
                    totalQuotaBytes={data.totalStorageBytes}
                  >
                    {t(p("edit"))}
                  </ChangeDefaultQuotaLink>
                )}
              </Space>
            </div>
            <Space>
              <span>
                {t(p("lastSyncTime"))}:{" "}
                {syncInfo.lastSyncTime ? formatDateTime(syncInfo.lastSyncTime) : t(p("notSynced"))}
              </span>
              <Button size="small" loading={syncLoading} onClick={handleSyncStorage} disabled={!cluster}>
                {t(p("syncStorage"))}
              </Button>
              <Button size="small" onClick={() => setBatchQuotaModalOpen(true)} disabled={selectedRowKeys.length === 0}>
                {t(p("batchModifyQuota"))}
              </Button>
            </Space>
          </>
        ) : undefined}
      </TableTitle>
      <Table
        rowKey={(i) => i.userId}
        dataSource={data?.usersQuotaInfo}
        loading={isLoading}
        rowSelection={rowSelection}
        pagination={
          setPageInfo
            ? {
                current: pageInfo.page,
                defaultPageSize: STORAGE_DEFAULT_PAGE_SIZE,
                pageSize: pageInfo.pageSize,
                showSizeChanger: true,
                total: data?.totalUserCount,
                onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
              }
            : false
        }
        tableLayout="fixed"
        onChange={handleTableChange}
      >
        <Table.Column<UserQuotaInfo>
          dataIndex="userId"
          ellipsis
          title={t(p("user"))}
          render={(_, r) => `${r.userName} (${r.userId})`}
        />
        <Table.Column<UserQuotaInfo>
          dataIndex="quotaBytes"
          ellipsis
          title={
            <div>
              {`${t(p("storageQuota"))}`}
              {replicaExist ? (
                <Tooltip title={t(p("storageQuotaTooltip"))}>
                  <QuestionCircleOutlined />
                </Tooltip>
              ) : (
                ""
              )}
              {" (GB)"}
            </div>
          }
          render={(_, r) => `${formatBytesToGB(r.quotaBytes).toFixed(2)}`}
          sorter={true}
          sortDirections={["ascend", "descend"]}
          sortOrder={sortInfo.field === "quotaBytes" ? sortInfo.order : undefined}
        />
        <Table.Column<UserQuotaInfo>
          dataIndex="usedStorageBytes"
          ellipsis
          title={`${t(p("storageUsed"))} (GB)`}
          render={(_, r) => `${formatBytesToGB(r.usedStorageBytes).toFixed(2)}`}
          sorter={true}
          sortDirections={["ascend", "descend"]}
          sortOrder={sortInfo.field === "usedStorageBytes" ? sortInfo.order : null}
        />
        <Table.Column<UserQuotaInfo>
          title={t(p("operation"))}
          fixed="right"
          render={(_, r) =>
            cluster && (
              <ChangeQuotaLink
                reload={reload}
                username={r.userName}
                userId={r.userId}
                cluster={cluster}
                path={path}
                quotaBytes={r.quotaBytes}
                usedStorageBytes={r.usedStorageBytes}
                useDefault={r.useDefault}
                totalQuotaBytes={data?.totalStorageBytes || 0}
                defaultQuotaBytes={data?.userDefaultQuotaBytes || 0}
              >
                {t(p("modifyQuota"))}
              </ChangeQuotaLink>
            )
          }
        />
      </Table>
      {/* 批量修改配额模态框 */}
      {batchQuotaModalOpen && cluster && (
        <UserQuotaChangeModal
          open={batchQuotaModalOpen}
          onClose={() => setBatchQuotaModalOpen(false)}
          reload={reload}
          cluster={cluster}
          path={path}
          selectedUsers={selectedUsers}
          defaultQuotaBytes={data?.userDefaultQuotaBytes || 0}
          totalQuotaBytes={data?.totalStorageBytes || 0}
          isBatch={true}
        />
      )}
    </>
  );
};

export const ChangeDefaultQuotaLink = ModalLink(UserDefaultQuotaChangeModal);
export const ChangeQuotaLink = ModalLink(UserQuotaChangeModal);
