import { QuestionCircleOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import {
  formatMBToGBString,
  formatMBToString,
} from "@scow/lib-web/build/utils/sizeFormatter";
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
import { type GetTenantQuotaSummarySchema } from "src/pages/api/storage/getTenantQuotaSummary";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster, getSortedClusterValues } from "src/utils/cluster";
import { getStorageDisplayName } from "src/utils/storageDisplay";

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface FilterForm {
  idOrName: string;
  storageId: string | undefined;
}

interface SortInfo {
  field: QuotaSortFieldType | undefined;
  order: QuotaSortOrderType | undefined;
}

interface StorageTabInfo {
  storageId: string;
  mountedClusters: Cluster[];
}

const p = prefix("pageComp.storage.tenantStorageManangerTable.");
const pCommon = prefix("common.");

// 文件系统实时查询成本较高，默认一次只取 10 个用户数据。
const STORAGE_DEFAULT_PAGE_SIZE = 10;

export const TenantStorageManagerTable: React.FC = () => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [sortInfo, setSortInfo] = useState<SortInfo>({ field: undefined, order: undefined });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserQuotaInfo[]>([]);

  const getTenantAssignedClusterIds = useCallback(async () => {
    const tenantAssignedClusterPartitions = await api.getTenantAssignedClustersAndPartitions({});
    return Object.keys(tenantAssignedClusterPartitions.assignedClusterPartitions);
  }, []);

  const { data: availableClusterIds, isLoading: availableClusterIdsLoading } = useAsync({
    promiseFn: getTenantAssignedClusterIds,
  });

  const {
    publicConfigClusters,
    publicStorageConfigs,
    clusterSortedIdList,
    activatedClusters,
    fullClusterConfigs,
  } = useStore(ClusterInfoStore);
  const sortedClusters = useMemo(
    () =>
      getSortedClusterValues(publicConfigClusters, clusterSortedIdList).filter((cluster) => {
        const clusterConfig = fullClusterConfigs[cluster.id];
        const hasQuotaEnabledStorage = (clusterConfig.entryPaths ?? []).some(
          (entryPath) => publicStorageConfigs[entryPath.storageId]?.quotaEnabled,
        );

        return (
          availableClusterIds?.includes(cluster.id) &&
          Object.keys(activatedClusters).includes(cluster.id) &&
          hasQuotaEnabledStorage
        );
      }),
    [
      activatedClusters,
      availableClusterIds,
      clusterSortedIdList,
      fullClusterConfigs,
      publicStorageConfigs,
      publicConfigClusters,
    ],
  );

  const sortedStorages = useMemo<StorageTabInfo[]>(() => {
    const storageMap = new Map<string, StorageTabInfo>();

    sortedClusters.forEach((cluster) => {
      (fullClusterConfigs[cluster.id].entryPaths ?? []).forEach((entryPath) => {
        if (!publicStorageConfigs[entryPath.storageId]?.quotaEnabled) {
          return;
        }

        const currentStorage = storageMap.get(entryPath.storageId);
        if (currentStorage) {
          currentStorage.mountedClusters.push(cluster);
          return;
        }

        storageMap.set(entryPath.storageId, {
          storageId: entryPath.storageId,
          mountedClusters: [cluster],
        });
      });
    });

    return Array.from(storageMap.values());
  }, [fullClusterConfigs, publicStorageConfigs, sortedClusters]);

  const [query, setQuery] = useState<FilterForm>(() => ({
    idOrName: "",
    storageId: undefined,
  }));
  const [form] = Form.useForm<FilterForm>();

  useEffect(() => {
    setQuery((currentQuery) => ({
      ...currentQuery,
      storageId:
        currentQuery.storageId &&
        sortedStorages.some((storage) => storage.storageId === currentQuery.storageId)
          ? currentQuery.storageId
          : sortedStorages[0]?.storageId,
    }));
  }, [sortedStorages]);

  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageSize: STORAGE_DEFAULT_PAGE_SIZE,
  });

  const selectedStorage = useMemo(
    () => sortedStorages.find((storage) => storage.storageId === query.storageId),
    [query.storageId, sortedStorages],
  );
  const selectedStorageLabel = useMemo(
    () => getStorageDisplayName(selectedStorage?.storageId, languageId, publicStorageConfigs),
    [languageId, publicStorageConfigs, selectedStorage?.storageId],
  );

  const listPromiseFn = useCallback(async () => {
    if (!query.storageId) {
      // 首次进入页面时，storageId 会在 effect 中回填为第一个可用文件系统；
      // 在默认值尚未初始化完成前，这里直接等待，不报错。
      return;
    }

    const queryParams: {
      storageId: string;
      idOrName?: string;
      page: number;
      pageSize?: number;
      sortField?: QuotaSortFieldType;
      sortOrder?: QuotaSortOrderType;
    } = {
      storageId: query.storageId,
      idOrName: query.idOrName,
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
    };

    if (sortInfo.field && sortInfo.order) {
      queryParams.sortField = sortInfo.field;
      queryParams.sortOrder = sortInfo.order;
    }

    return await api.getTenantQuota({ query: queryParams });
  }, [
    pageInfo.page,
    pageInfo.pageSize,
    query.idOrName,
    query.storageId,
    sortInfo,
  ]);

  const summaryPromiseFn = useCallback(async () => {
    if (!query.storageId) {
      return;
    }

    return await api.getTenantQuotaSummary({ query: { storageId: query.storageId } });
  }, [query.storageId]);

  const {
    data: listData,
    isLoading: listLoading,
    reload: reloadList,
  } = useAsync({
    promiseFn: listPromiseFn,
    skip: !query.storageId,
  });
  const {
    data: summaryData,
    isLoading: summaryLoading,
    reload: reloadSummary,
  } = useAsync({
    promiseFn: summaryPromiseFn,
    skip: !query.storageId,
  });

  const reload = useCallback(() => {
    reloadList();
    reloadSummary();
  }, [reloadList, reloadSummary]);

  return (
    <>
      {!listLoading &&
      !summaryLoading &&
      !availableClusterIdsLoading &&
      sortedStorages.length === 0 ? (
        <Result title={t(p("clusterNotEnabledStorageManager"))} />
      ) : (
        <div>
          <FilterFormContainer>
            <Form<FilterForm>
              form={form}
              initialValues={query}
              onFinish={async () => {
                const currentQuery = await form.validateFields();
                setQuery((previousQuery) => ({
                  ...previousQuery,
                  idOrName: currentQuery.idOrName,
                }));
                setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
                setSortInfo({ field: undefined, order: undefined });
              }}
            >
              <FilterFormTabs
                onChange={(storageId) => {
                  if (!sortedStorages.some((storage) => storage.storageId === storageId)) {
                    return;
                  }

                  setQuery((previousQuery) => ({
                    ...previousQuery,
                    storageId,
                  }));
                  setSelectedRowKeys([]);
                  setSelectedUsers([]);
                  setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
                  setSortInfo({ field: undefined, order: undefined });
                }}
                tabs={sortedStorages.map((storage) => ({
                  title: getStorageDisplayName(storage.storageId, languageId, publicStorageConfigs),
                  key: storage.storageId,
                  node: (
                    <Space>
                      <Form.Item label={t(pCommon("user"))} name="idOrName">
                        <Input placeholder={t(pCommon("idOrName"))} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit">
                        {t(pCommon("search"))}
                      </Button>
                    </Space>
                  ),
                }))}
              />
            </Form>
          </FilterFormContainer>

          <StorageInfoTable
            listData={listData}
            summaryData={summaryData}
            isLoading={listLoading || summaryLoading || availableClusterIdsLoading}
            mountedClusterNames={(summaryData?.mountedClusters ?? []).map((clusterId) =>
              getI18nConfigCurrentText(
                publicConfigClusters[clusterId]?.name ?? clusterId,
                languageId,
              ),
            )}
            pageInfo={pageInfo}
            reload={reload}
            selectedRowKeys={selectedRowKeys}
            selectedUsers={selectedUsers}
            setPageInfo={setPageInfo}
            setSelectedRowKeys={setSelectedRowKeys}
            setSelectedUsers={setSelectedUsers}
            setSortInfo={setSortInfo}
            sortInfo={sortInfo}
            storageId={query.storageId}
            storageLabel={selectedStorageLabel}
          />
        </div>
      )}
    </>
  );
};

interface StorageInfoTableProps {
  listData: Static<(typeof GetTenantQuotaSchema)["responses"]["200"]> | undefined;
  summaryData: Static<(typeof GetTenantQuotaSummarySchema)["responses"]["200"]> | undefined;
  isLoading: boolean;
  mountedClusterNames: string[];
  pageInfo: PageInfo;
  reload: () => void;
  selectedRowKeys: string[];
  selectedUsers: UserQuotaInfo[];
  setPageInfo: (info: PageInfo) => void;
  setSelectedRowKeys: (keys: string[]) => void;
  setSelectedUsers: (users: UserQuotaInfo[]) => void;
  setSortInfo: (info: SortInfo) => void;
  sortInfo: SortInfo;
  storageId: string | undefined;
  storageLabel: string;
}

const StorageInfoTable: React.FC<StorageInfoTableProps> = ({
  listData,
  summaryData,
  isLoading,
  mountedClusterNames,
  pageInfo,
  reload,
  selectedRowKeys,
  selectedUsers,
  setPageInfo,
  setSelectedRowKeys,
  setSelectedUsers,
  setSortInfo,
  sortInfo,
  storageId,
  storageLabel,
}) => {
  const t = useI18nTranslateToString();
  const { message } = App.useApp();

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ lastSyncTime?: string }>({});
  const [batchQuotaModalOpen, setBatchQuotaModalOpen] = useState(false);

  const handleTableChange = (_pagination, _filters, sorter) => {
    if (sorter?.field && sorter.order) {
      setSortInfo({
        field: sorter.field,
        order: sorter.order,
      });
      return;
    }

    setSortInfo({
      field: undefined,
      order: undefined,
    });
  };

  const fetchSyncInfo = useCallback(async () => {
    if (!storageId) {
      return;
    }

    try {
      const response = await api.getStorageSyncInfo({ query: { storageId } });
      setSyncInfo(response);
    } catch (error) {
      console.error("Failed to fetch sync info:", error);
    }
  }, [storageId]);

  const handleSyncStorage = async () => {
    if (!storageId) {
      return;
    }

    setSyncLoading(true);
    try {
      await api.syncTenantUsersStorageUsage({ body: { storageId } });
      message.success(t(p("syncSuccess")));
      reload();
      fetchSyncInfo();
    } catch {
      message.error(t(p("syncFailed")));
    } finally {
      setSyncLoading(false);
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: string[], rows: UserQuotaInfo[]) => {
      setSelectedRowKeys(keys);
      setSelectedUsers(rows);
    },
  };

  useEffect(() => {
    fetchSyncInfo();
  }, [fetchSyncInfo]);

  return (
    <>
      <TableTitle justify="space-between">
        {summaryData ? (
          <div style={{ width: "100%" }}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                justifyContent: "space-between",
              }}
            >
              <Space split={<Divider type="vertical" />} wrap>
                <span>
                  <Space>
                    {t(p("totalStorage"))}
                    <span>{formatMBToString(summaryData.totalStorageMb)}</span>
                  </Space>
                </span>
                <span>
                  <Space>
                    {t(p("remainingStorage"))}
                    <span>{formatMBToString(summaryData.remainingStorageMb)}</span>
                  </Space>
                </span>
                <span>
                  <Space>
                    {t(p("mountedClusters"))}
                    <span>
                      {mountedClusterNames.length > 0 ? mountedClusterNames.join(", ") : "-"}
                    </span>
                  </Space>
                </span>
              </Space>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <Space split={<Divider type="vertical" />} wrap>
                <span>
                  <Space>
                    {t(p("tenantAssignedQuota"))}
                    <span>{formatMBToString(summaryData.tenantAssignedQuotaMb)}</span>
                    <Tooltip title={t(p("tenantAssignedQuotaTooltip"))}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                </span>
                <span>
                  <Space>
                    {t(p("tenantUsedStorage"))}
                    <span>{formatMBToString(summaryData.tenantUsedStorageMb)}</span>
                    <Tooltip title={t(p("tenantUsedStorageTooltip"))}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                </span>
                <span>
                  <Space>
                    {t(p("userDefaultQuota"))}
                    <span>{`${formatMBToGBString(summaryData.userDefaultQuotaMb)} GB`}</span>
                  </Space>
                </span>
                {storageId && (
                  <ChangeDefaultQuotaLink
                    defaultQuotaMb={summaryData.userDefaultQuotaMb}
                    reload={reload}
                    storageId={storageId}
                    storageLabel={storageLabel}
                    totalQuotaMb={summaryData.totalStorageMb}
                  >
                    {t(p("edit"))}
                  </ChangeDefaultQuotaLink>
                )}
              </Space>
              <Space>
                <span>
                  {t(p("lastSyncTime"))}:{" "}
                  {syncInfo.lastSyncTime
                    ? formatDateTime(syncInfo.lastSyncTime)
                    : t(p("notSynced"))}
                </span>
                <Button
                  disabled={!storageId}
                  loading={syncLoading}
                  onClick={handleSyncStorage}
                  size="small"
                >
                  {t(p("syncStorage"))}
                </Button>
                <Button
                  disabled={selectedRowKeys.length === 0}
                  onClick={() => setBatchQuotaModalOpen(true)}
                  size="small"
                >
                  {t(p("batchModifyQuota"))}
                </Button>
              </Space>
            </div>
          </div>
        ) : undefined}
      </TableTitle>
      <Table
        dataSource={listData?.usersQuotaInfo}
        loading={isLoading}
        onChange={handleTableChange}
        pagination={{
          current: pageInfo.page,
          defaultPageSize: STORAGE_DEFAULT_PAGE_SIZE,
          onChange: (page, currentPageSize) => setPageInfo({ page, pageSize: currentPageSize }),
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: listData?.totalUserCount,
        }}
        rowKey={(item) => item.userId}
        rowSelection={rowSelection}
        tableLayout="fixed"
      >
        <Table.Column<UserQuotaInfo>
          dataIndex="userId"
          ellipsis
          render={(_, row) => `${row.userName} (${row.userId})`}
          title={t(p("user"))}
        />
        <Table.Column<UserQuotaInfo>
          dataIndex="quotaMb"
          ellipsis
          render={(_, row) => formatMBToGBString(row.quotaMb)}
          sortDirections={["ascend", "descend"]}
          sortOrder={sortInfo.field === "quotaMb" ? sortInfo.order : undefined}
          sorter={true}
          title={
            <div>
              {t(p("storageQuota"))}
              <Tooltip title={t(p("storageQuotaTooltip"))}>
                <QuestionCircleOutlined />
              </Tooltip>
              {" (GB)"}
            </div>
          }
        />
        <Table.Column<UserQuotaInfo>
          dataIndex="usedStorageMb"
          ellipsis
          render={(_, row) => formatMBToGBString(row.usedStorageMb)}
          sortDirections={["ascend", "descend"]}
          sortOrder={sortInfo.field === "usedStorageMb" ? sortInfo.order : null}
          sorter={true}
          title={`${t(p("storageUsed"))} (GB)`}
        />
        <Table.Column<UserQuotaInfo>
          fixed="right"
          render={(_, row) =>
            storageId ? (
              <ChangeQuotaLink
                defaultQuotaMb={summaryData?.userDefaultQuotaMb || 0}
                quotaMb={row.quotaMb}
                reload={reload}
                storageId={storageId}
                storageLabel={storageLabel}
                totalQuotaMb={summaryData?.totalStorageMb || 0}
                useDefault={row.useDefault}
                usedStorageMb={row.usedStorageMb}
                userId={row.userId}
                username={row.userName}
              >
                {t(p("modifyQuota"))}
              </ChangeQuotaLink>
            ) : null
          }
          title={t(p("operation"))}
        />
      </Table>
      {batchQuotaModalOpen && storageId ? (
        <UserQuotaChangeModal
          defaultQuotaMb={summaryData?.userDefaultQuotaMb || 0}
          isBatch={true}
          onClose={() => setBatchQuotaModalOpen(false)}
          open={batchQuotaModalOpen}
          reload={reload}
          selectedUsers={selectedUsers}
          storageId={storageId}
          storageLabel={storageLabel}
          totalQuotaMb={summaryData?.totalStorageMb || 0}
        />
      ) : null}
    </>
  );
};

export const ChangeDefaultQuotaLink = ModalLink(UserDefaultQuotaChangeModal);
export const ChangeQuotaLink = ModalLink(UserQuotaChangeModal);
