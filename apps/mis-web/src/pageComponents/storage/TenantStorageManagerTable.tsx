import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { formatBytesToGB,formatBytesToString } from "@scow/lib-web/build/utils/sizeFormatter";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Static } from "@sinclair/typebox";
import { App, Button, Divider, Form, Input, Space, Table } from "antd";
import React, { useCallback, useMemo, useState } from "react";
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
import { UserStore } from "src/stores/UserStore";
import { Cluster, getSortedClusterValues } from "src/utils/cluster";

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface FilterForm {
  idOrName: string;
  cluster: Cluster;
}

interface Props {
}


const p = prefix("pageComp.storage.tenantStorageManangerTable.");
const pCommon = prefix("common.");

export const TenantStorageManagerTable: React.FC<Props> = () => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const { message } = App.useApp();

  const userStore = useStore(UserStore);

  const {
    publicConfigClusters, clusterSortedIdList, activatedClusters, fullClusterConfigs,
  } = useStore(ClusterInfoStore);
  const sortedClusters = useMemo(() => getSortedClusterValues(publicConfigClusters, clusterSortedIdList)
    .filter((x) => {
      return Object.keys(activatedClusters).includes(x.id) && fullClusterConfigs[x.id].storage?.enabled;
    }), [activatedClusters]);

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      idOrName: "",
      cluster: sortedClusters[0],
    };
  });
  const [form] = Form.useForm<FilterForm>();

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const storageConfig = useMemo(() => {
    return fullClusterConfigs[query.cluster.id].storage;
  }, [query.cluster]);

  const promiseFn = useCallback(async () => {
    if (!storageConfig) {
      message.error(t(p("notFoundStorageConfig")));
      return;
    }

    return await api.getTenantQuota({ query: {
      ...query,
      tenantName: userStore.user!.tenant,
      cluster: query.cluster.id,
      path: storageConfig.paths[0],
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
    } });
  }, [pageInfo, query]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  return (
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
              }
            }}
            tabs={
              sortedClusters.map((cluster) => ({
                title: getI18nConfigCurrentText(cluster.name, languageId), key: cluster.id, node: (
                  <>
                    <Space>
                      <Form.Item label={"用户"} name="idOrName">
                        <Input placeholder="用户ID/姓名" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit">{t(pCommon("search"))}</Button>
                    </Space>
                  </>
                ),
              }))
            }
          />
        </Form>
      </FilterFormContainer>
      <StorageInfoTable
        reload={reload}
        data={data}
        isLoading={isLoading}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        tenantName={userStore.user!.tenant}
        cluster={query.cluster}
        path={storageConfig?.paths[0] || "" }
      />
    </div>
  );
};

interface StorageInfoTableProps {
  data: Static<typeof GetTenantQuotaSchema["responses"]["200"]> | undefined;
  pageInfo: PageInfo;
  setPageInfo?: (info: PageInfo) => void;
  isLoading: boolean;
  reload: () => void;
  tenantName: string;
  cluster: Cluster;
  path: string;
}


const StorageInfoTable: React.FC<StorageInfoTableProps> = ({
  data, pageInfo, setPageInfo, isLoading, reload, tenantName, cluster, path,
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
                  <strong>{formatBytesToString(data.totalStorageBytes)}</strong>
                </Space>
              </span>
              <Divider type="vertical" />
              <span>
                <Space>
                  {t(p("remainingStorage"))}
                  <strong>{formatBytesToString(data.remainingStorageBytes)}</strong>
                </Space>
              </span>
              <Divider type="vertical" />
              <Space>
                <span>
                  <Space>
                    {t(p("userDefaultQuota"))}
                    <strong>{formatBytesToGB(data.userDefaultQuotaBytes).toFixed(2) + " GB"}</strong>
                  </Space>
                </span>
                <ChangeDefaultQuotaLink
                  reload={reload}
                  tenantName={tenantName}
                  cluster={cluster}
                  path={path}
                  defaultQuotaBytes={data.userDefaultQuotaBytes}
                  totalQuotaBytes={data.totalStorageBytes}
                >{t(p("edit"))}</ChangeDefaultQuotaLink>
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
            >{t(p("modifyQuota"))}</ChangeQuotaLink>
          )}
        />
      </Table>
    </>
  );
};

export const ChangeDefaultQuotaLink = ModalLink(UserDefaultQuotaChangeModal);
export const ChangeQuotaLink = ModalLink(UserQuotaChangeModal);

