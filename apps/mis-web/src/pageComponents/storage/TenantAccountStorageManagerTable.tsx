import { QuestionCircleOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { formatMBToString } from "@scow/lib-web/build/utils/sizeFormatter";
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
import { AccountDefaultQuotaChangeModal } from "src/pageComponents/storage/AccountDefaultQuotaChangeModal";
import { AccountQuotaChangeModal } from "src/pageComponents/storage/AccountQuotaChangeModal";
import { type AccountQuotaInfo as AccountQuotaInfoSchema, type GetAccountQuotaSchema } from "src/pages/api/tenant/accountStorageQuota/getAccountQuota";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getSortedClusterValues } from "src/utils/cluster";
import { NUMERIC_GROUP_NAME_RESOLUTION_FAILED } from "src/utils/constants";
import { getStorageDisplayName } from "src/utils/storageDisplay";

type AccountQuotaInfo = Static<typeof AccountQuotaInfoSchema>;

interface FilterForm {
  accountName: string;
  storageId: string | undefined;
}

interface PageInfo {
  page: number;
  pageSize?: number;
}

const p = prefix("pageComp.storage.tenantAccountStorageManagerTable.");
const pCommon = prefix("common.");

const STORAGE_DEFAULT_PAGE_SIZE = 10;

export const TenantAccountStorageManagerTable: React.FC = () => {

  const t = useI18nTranslateToString();
  const { message } = App.useApp();
  const languageId = useI18n().currentLanguage.id;

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
    [activatedClusters, availableClusterIds, clusterSortedIdList, fullClusterConfigs,
      publicStorageConfigs, publicConfigClusters],
  );

  // 去重并按集群顺序整理出具有配额管理功能的文件系统列表
  const sortedStorages = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    sortedClusters.forEach((cluster) => {
      (fullClusterConfigs[cluster.id].entryPaths ?? []).forEach((entryPath) => {
        if (publicStorageConfigs[entryPath.storageId]?.quotaEnabled && !seen.has(entryPath.storageId)) {
          seen.add(entryPath.storageId);
          result.push(entryPath.storageId);
        }
      });
    });
    return result;
  }, [fullClusterConfigs, publicStorageConfigs, sortedClusters]);

  const [query, setQuery] = useState<FilterForm>(() => ({
    accountName: "",
    storageId: undefined,
  }));

  const [form] = Form.useForm<FilterForm>();

  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageSize: STORAGE_DEFAULT_PAGE_SIZE,
  });

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<AccountQuotaInfo[]>([]);

  // 当可用文件系统列表变化时，确保 storageId 指向有效的文件系统
  useEffect(() => {
    setQuery((currentQuery) => ({
      ...currentQuery,
      storageId:
        currentQuery.storageId && sortedStorages.includes(currentQuery.storageId)
          ? currentQuery.storageId
          : sortedStorages[0],
    }));
  }, [sortedStorages]);

  const promiseFn = useCallback(async () => {
    if (!query.storageId) {
      return;
    }
    return api.getAccountQuota({
      query: {
        storageId: query.storageId,
        accountName: query.accountName || undefined,
      },
    }).httpError(500, (error) => {
      if (error.code === NUMERIC_GROUP_NAME_RESOLUTION_FAILED) {
        message.error(`${t("common.groupNameResolutionFailed")}${error.details ? ` ${error.details}` : ""}`);
      }
    });
  }, [query.storageId, query.accountName, sortedStorages.length]);

  const { data, isLoading, reload } = useAsync({ promiseFn, skip: !query.storageId });

  const selectedStorageLabel = useMemo(
    () => getStorageDisplayName(query.storageId, languageId, publicStorageConfigs),
    [languageId, publicStorageConfigs, query.storageId],
  );

  return (
    <>
      {!isLoading && !availableClusterIdsLoading && sortedStorages.length === 0 ? (
        <Result title={t(p("noStorageConfig"))} />
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
                  accountName: currentQuery.accountName,
                }));
                setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
                setSelectedRowKeys([]);
                setSelectedAccounts([]);
              }}
            >
              <FilterFormTabs
                onChange={(storageId) => {
                  if (!sortedStorages.includes(storageId)) return;
                  setQuery((previousQuery) => ({
                    ...previousQuery,
                    storageId,
                  }));
                  setSelectedRowKeys([]);
                  setSelectedAccounts([]);
                  setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
                }}
                tabs={sortedStorages.map((storageId) => ({
                  title: getStorageDisplayName(storageId, languageId, publicStorageConfigs),
                  key: storageId,
                  node: (
                    <Space>
                      <Form.Item label={t(pCommon("account"))} name="accountName">
                        <Input placeholder={t(pCommon("accountName"))} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
                    </Space>
                  ),
                }))}
              />
            </Form>
          </FilterFormContainer>
          <StorageInfoTable
            data={data}
            isLoading={isLoading || availableClusterIdsLoading}
            mountedClusterNames={(data?.mountedClusters ?? []).map((clusterId) =>
              getI18nConfigCurrentText(
                publicConfigClusters[clusterId]?.name ?? clusterId,
                languageId,
              ),
            )}
            pageInfo={pageInfo}
            reload={reload}
            storageId={query.storageId}
            storageLabel={selectedStorageLabel}
            selectedRowKeys={selectedRowKeys}
            selectedAccounts={selectedAccounts}
            setPageInfo={setPageInfo}
            setSelectedRowKeys={setSelectedRowKeys}
            setSelectedAccounts={setSelectedAccounts}
          />
        </div>
      )}
    </>
  );
};

interface StorageInfoTableProps {
  data: Static<typeof GetAccountQuotaSchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  mountedClusterNames: string[];
  pageInfo: PageInfo;
  reload: () => void;
  storageId: string | undefined;
  storageLabel: string;
  selectedRowKeys: string[];
  selectedAccounts: AccountQuotaInfo[];
  setPageInfo: (info: PageInfo) => void;
  setSelectedRowKeys: (keys: string[]) => void;
  setSelectedAccounts: (accounts: AccountQuotaInfo[]) => void;
}

const StorageInfoTable: React.FC<StorageInfoTableProps> = ({
  data, isLoading, mountedClusterNames, pageInfo, reload, storageId, storageLabel,
  selectedRowKeys, selectedAccounts, setPageInfo, setSelectedRowKeys, setSelectedAccounts,
}) => {

  const t = useI18nTranslateToString();
  const { message } = App.useApp();

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ lastSyncTime?: string }>({});
  const [batchQuotaModalOpen, setBatchQuotaModalOpen] = useState(false);

  const fetchSyncInfo = useCallback(async () => {
    if (!storageId) return;
    try {
      const response = await api.getAccountStorageSyncInfo({ query: { storageId } });
      setSyncInfo(response);
    } catch {
      // ignore
    }
  }, [storageId]);

  const handleSyncStorage = async () => {
    if (!storageId) return;
    setSyncLoading(true);
    let groupNameResolutionErrorHandled = false;

    try {
      await api.syncTenantAccountsStorageUsage({ body: { storageId } }).httpError(500, (error) => {
        if (error.code === NUMERIC_GROUP_NAME_RESOLUTION_FAILED) {
          groupNameResolutionErrorHandled = true;
          message.error(`${t("common.groupNameResolutionFailed")}${error.details ? ` ${error.details}` : ""}`);
        }
      });
      message.success(t(p("syncSuccess")));
      reload();
      fetchSyncInfo();
    } catch {
      if (!groupNameResolutionErrorHandled) message.error(t(p("syncFailed")));
    } finally {
      setSyncLoading(false);
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: string[], rows: AccountQuotaInfo[]) => {
      setSelectedRowKeys(keys);
      setSelectedAccounts(rows);
    },
  };

  useEffect(() => {
    fetchSyncInfo();
  }, [fetchSyncInfo]);

  return (
    <>
      <TableTitle justify="space-between">
        {data ? (
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
                    <span>{formatMBToString(data.totalStorageMb)}</span>
                  </Space>
                </span>
                <span>
                  <Space>
                    {t(p("remainingStorage"))}
                    <span>{formatMBToString(data.remainingStorageMb)}</span>
                  </Space>
                </span>
                <span>
                  <Space>
                    {t(p("mountedClusters"))}
                    <span>{mountedClusterNames.length > 0 ? mountedClusterNames.join(", ") : "-"}</span>
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
                    {t(p("accountDefaultQuota"))}
                    <span>{`${(data.accountDefaultQuotaMb / 1024).toFixed(2)} GB`}</span>
                  </Space>
                </span>
                {storageId && (
                  <ChangeDefaultQuotaLink
                    defaultQuotaMb={data.accountDefaultQuotaMb}
                    reload={reload}
                    storageId={storageId}
                    storageLabel={storageLabel}
                    totalStorageMb={data.totalStorageMb}
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
        rowKey={(r) => r.accountName}
        dataSource={data?.accountsQuotaInfo}
        loading={isLoading}
        tableLayout="fixed"
        rowSelection={rowSelection}
        pagination={{
          current: pageInfo.page,
          defaultPageSize: STORAGE_DEFAULT_PAGE_SIZE,
          onChange: (page, currentPageSize) => setPageInfo({ page, pageSize: currentPageSize }),
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
        }}
      >
        <Table.Column<AccountQuotaInfo>
          dataIndex="accountName"
          ellipsis
          title={t(p("account"))}
          render={(_, r) => r.accountName}
        />
        <Table.Column<AccountQuotaInfo>
          dataIndex="ownerId"
          ellipsis
          title={t(p("owner"))}
          render={(_, r) => `${r.ownerName || "-"}（ID: ${r.ownerId || "-"}）`}
        />
        <Table.Column<AccountQuotaInfo>
          dataIndex="quotaMb"
          ellipsis
          title={(
            <Space size={4}>
              {t(p("storageQuota"))}
              <Tooltip title={t(p("storageQuotaTooltip"))}>
                <QuestionCircleOutlined />
              </Tooltip>
              {" (GB)"}
            </Space>
          )}
          render={(_, r) => (r.quotaMb / 1024).toFixed(2)}
        />
        <Table.Column<AccountQuotaInfo>
          dataIndex="usedStorageMb"
          ellipsis
          title={(
            <Space size={4}>
              {t(p("usedStorage"))}
              <Tooltip title={t(p("usedStorageTooltip"))}>
                <QuestionCircleOutlined />
              </Tooltip>
              {" (GB)"}
            </Space>
          )}
          render={(_, r) => (r.usedStorageMb / 1024).toFixed(2)}
        />
        <Table.Column<AccountQuotaInfo>
          title={t(p("operation"))}
          fixed="right"
          render={(_, r) =>
            storageId ? (
              <ChangeQuotaLink
                reload={reload}
                accountName={r.accountName}
                ownerName={r.ownerName}
                storageId={storageId}
                storageLabel={storageLabel}
                quotaMb={r.quotaMb}
                usedStorageMb={r.usedStorageMb}
                useDefault={r.useDefault}
                totalStorageMb={data?.totalStorageMb || 0}
                defaultQuotaMb={data?.accountDefaultQuotaMb || 0}
              >
                {t(p("modifyQuota"))}
              </ChangeQuotaLink>
            ) : null
          }
        />
      </Table>
      {batchQuotaModalOpen && storageId ? (
        <AccountQuotaChangeModal
          isBatch={true}
          open={batchQuotaModalOpen}
          onClose={() => {
            setBatchQuotaModalOpen(false);
            setSelectedRowKeys([]);
            setSelectedAccounts([]);
          }}
          reload={reload}
          selectedAccounts={selectedAccounts}
          storageId={storageId}
          storageLabel={storageLabel}
          totalStorageMb={data?.totalStorageMb || 0}
          defaultQuotaMb={data?.accountDefaultQuotaMb || 0}
        />
      ) : null}
    </>
  );
};

export const ChangeDefaultQuotaLink = ModalLink(AccountDefaultQuotaChangeModal);
export const ChangeQuotaLink = ModalLink(AccountQuotaChangeModal);
