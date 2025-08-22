import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { formatBytesToGB,formatBytesToString } from "@scow/lib-web/build/utils/sizeFormatter";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Input, Result, Space, Table } from "antd";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { ModalLink } from "src/components/ModalLink";
import { TableTitle } from "src/components/TableTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
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

interface Props {
}


const p = prefix("pageComp.storage.tenantStorageManangerTable.");
const pCommon = prefix("common.");

export const TenantStorageManagerTable: React.FC<Props> = () => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

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

  const {
    publicConfigClusters, clusterSortedIdList, activatedClusters, fullClusterConfigs,
  } = useStore(ClusterInfoStore);
  const sortedClusters = useMemo(() => getSortedClusterValues(publicConfigClusters, clusterSortedIdList)
    .filter((x) => {
      return (publicConfig.SCOW_RESOURCE_ENABLED ? availableClusterIds?.includes(x.id) : true)
        && Object.keys(activatedClusters).includes(x.id)
        && fullClusterConfigs[x.id].storage?.enabled;
    }), [availableClusterIds, activatedClusters, fullClusterConfigs]);

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

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

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

    return await api.getTenantQuota({ query: {
      ...query,
      cluster: query.cluster.id,
      path: storageConfig.paths[0],
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
    } });
  }, [pageInfo, query]);

  const { data, isLoading, reload } = useAsync({ promiseFn, skip: !query.cluster });

  return (
    <>
      {
        !isLoading && !availableClusterIdsLoading && sortedClusters.length === 0 ? (
          <Result
            title={t(p("clusterNotEnabledStorageManager"))}
          />
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
                } }
              >
                <FilterFormTabs
                  onChange={(clusterId) => {
                    const cluster = sortedClusters.find((cluster) => cluster.id === clusterId);
                    if (cluster) {
                      setQuery({
                        ...query,
                        cluster,
                      });
                    }
                  } }
                  tabs={sortedClusters.map((cluster) => ({
                    title: getI18nConfigCurrentText(cluster.name, languageId), key: cluster.id, node: (
                      <>
                        <Space>
                          <Form.Item label={t(pCommon("user"))} name="idOrName">
                            <Input placeholder={t(pCommon("idOrName"))} />
                          </Form.Item>
                          <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
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
              path={storageConfig?.paths[0] || ""}
            />
          </div>
        )
      }
    </>
  );
};

interface StorageInfoTableProps {
  data: Static<typeof GetTenantQuotaSchema["responses"]["200"]> | undefined;
  pageInfo: PageInfo;
  setPageInfo?: (info: PageInfo) => void;
  isLoading: boolean;
  reload: () => void;
  cluster: Cluster | undefined;
  path: string;
}


const StorageInfoTable: React.FC<StorageInfoTableProps> = ({
  data, pageInfo, setPageInfo, isLoading, reload, cluster, path,
}) => {

  const t = useI18nTranslateToString();

  return (
    <>
      <TableTitle justify="space-between">
        {
          data ? (
            <div>
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
                {
                  cluster && (
                    <ChangeDefaultQuotaLink
                      reload={reload}
                      cluster={cluster}
                      path={path}
                      defaultQuotaBytes={data.userDefaultQuotaBytes}
                      totalQuotaBytes={data.totalStorageBytes}
                    >{t(p("edit"))}</ChangeDefaultQuotaLink>
                  )
                }
              </Space>
            </div>
          ) : undefined
        }
      </TableTitle>
      <Table
        rowKey={(i) => i.userId}
        dataSource={data?.usersQuotaInfo}
        loading={isLoading}
        pagination={setPageInfo ? {
          current: pageInfo.page,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.totalUserCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        } : false}
        tableLayout="fixed"
      >
        <Table.Column<UserQuotaInfo>
          dataIndex="userId"
          ellipsis
          title={t(p("user"))}
          render={(_, r) => `${r.userId} (${r.userName})`}
        />
        <Table.Column<UserQuotaInfo>
          dataIndex="quotaBytes"
          ellipsis
          title={`${t(p("storageQuota"))} (GB)`}
          render={(_, r) => `${formatBytesToGB(r.quotaBytes).toFixed(2)}`}
        />
        <Table.Column<UserQuotaInfo>
          dataIndex="usedQuotaBytes"
          ellipsis
          title={`${t(p("storageUsed"))} (GB)`}
          render={(_, r) => `${formatBytesToGB(r.usedStorageBytes).toFixed(2)}`}
        />
        <Table.Column<UserQuotaInfo>
          title={t(p("operation"))}
          fixed="right"
          render={(_, r) => (
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
          )}
        />
      </Table>
    </>
  );
};

export const ChangeDefaultQuotaLink = ModalLink(UserDefaultQuotaChangeModal);
export const ChangeQuotaLink = ModalLink(UserQuotaChangeModal);

