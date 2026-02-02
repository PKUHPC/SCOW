import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { TargetAppList } from "@scow/protos/build/server/app_authorization";
import { Static } from "@sinclair/typebox";
import { Button, Divider, Form, Input, Space, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AppAuthTargetType } from "src/models/app";
import type { GetTargetAppAuthorizationsSchema } from "src/pages/api/admin/authorization/getTargetAppAuthorizations";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

import { AppAuthInfoDrawer, TargetAppsDrawerItem } from "./AppAuthInfoDrawer";
import { AuthorizeAppModalLink } from "./AuthorizeAppModal";

interface FilterForm {
  filterName: string | undefined;
}

interface PageInfo {
  page: number;
  pageSize: number;
}

interface Props {
  targetType: AppAuthTargetType;
  loading: boolean;
  tenantAvailableClusterIds?: string[];
  reload?: () => void;
}

const p = prefix("pageComp.commonComponent.appAuthorization.appAuthorizationTable.");

export const AppAuthorizationTable: React.FC<Props> = ({ targetType, tenantAvailableClusterIds, loading, reload }) => {

  const { activatedClusters } = useStore(ClusterInfoStore);

  if (Object.keys(activatedClusters).length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const [selectedClusterId, setSelectedClusterId] = useState<string>("");

  const availableClusters: Record<string, Cluster> = useMemo(() => {
    if (targetType === AppAuthTargetType.ACCOUNT && publicConfig.SCOW_RESOURCE_ENABLED) {
      const clusters = Object.entries(activatedClusters)
        .filter(([clusterId, _]) => tenantAvailableClusterIds?.includes(clusterId))
        .reduce((result, [clusterId, cluster]) => {
          result[clusterId] = cluster;
          return result;
        }, {});
      return clusters;
    }
    return activatedClusters;
  }, [targetType, activatedClusters, tenantAvailableClusterIds]);

  // 仅在初始化时或当前选中的集群不再可用时才设置
  useEffect(() => {
    const clusterEntries = Object.entries(availableClusters);
    if (clusterEntries.length > 0) {
      if (!selectedClusterId || !availableClusters[selectedClusterId]) {
        setSelectedClusterId(clusterEntries[0][0]);
      }
    }
  }, [availableClusters, selectedClusterId]);

  const [query, setQuery] = useState<FilterForm>(() => {
    return { filterName: undefined };
  });

  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [filterForm] = Form.useForm<FilterForm>();

  const promiseFn = useCallback(async () => {

    if (selectedClusterId === "") {
      return undefined;
    };

    return await api.getTargetAppAuthorizations({
      query: {
        page: pageInfo.page,
        pageSize: pageInfo.pageSize,
        clusterId: selectedClusterId,
        targetType,
        filterTargetName: query.filterName,
      },
    });
  }, [query, pageInfo, selectedClusterId]);
  const { data, isLoading, reload: reloadTargetAppList } = useAsync({ promiseFn });

  const reloadFullTable = () => {
    reload?.();
    reloadTargetAppList();
  };

  const handleClusterChange = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    filterForm.resetFields();
    setQuery({ filterName: undefined });
  };

  return (
    <div>
      <FilterFormContainer>
        <Form<FilterForm>
          layout="inline"
          form={filterForm}
          initialValues={query}
          onFinish={async () => {
            const { filterName } = await filterForm.validateFields();
            setQuery({ filterName: filterName === "" ? undefined : filterName?.trim() });
            setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
          }}
        >
          <FilterFormTabs
            tabs={Object.entries(availableClusters).map(([clusterId, cluster]) => ({
              title: `${getI18nConfigCurrentText(cluster.name, languageId) || clusterId}`,
              key: clusterId,
              node: (
                <>
                  <Form.Item
                    label={targetType === AppAuthTargetType.TENANT ? t(p("tenant")) : t(p("account"))}
                    name="filterName"
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">{t("common.search")}</Button>
                  </Form.Item>
                </>
              ),
            }))}
            onChange={handleClusterChange}
          />
        </Form>
      </FilterFormContainer>

      <AppAuthorizationInfoTable
        clusterId={selectedClusterId}
        targetType={targetType}
        data={data}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        isLoading={isLoading || loading}
        reload={() => {
          reloadFullTable();
        }}
      />

    </div>
  );
};



interface AppAuthorizationInfoTableProps {
  clusterId: string;
  targetType: AppAuthTargetType;
  data?: Static<typeof GetTargetAppAuthorizationsSchema["responses"]["200"]> | undefined;
  pageInfo: PageInfo;
  setPageInfo?: (info: PageInfo) => void;
  isLoading: boolean;
  reload: () => void;
}

const AppAuthorizationInfoTable: React.FC<AppAuthorizationInfoTableProps> = ({
  clusterId, targetType, data, pageInfo, setPageInfo, isLoading, reload,
}) => {

  const filteredData = data?.appLists;
  const t = useI18nTranslateToString();

  const [previewItem, setPreviewItem] = useState<TargetAppsDrawerItem | undefined>(undefined);

  return (
    <>
      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        rowKey="targetName"
        loading={isLoading}
        pagination={setPageInfo ? {
          current: pageInfo.page,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.totalCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        } : false}
        scroll={{ x: true }}
      >
        <Table.Column<TargetAppList>
          dataIndex="targetName"
          title={targetType === AppAuthTargetType.TENANT ? t(p("tenant")) : t(p("account"))}
        />
        <Table.Column<TargetAppList>
          dataIndex="availableAppsCount"
          title={t(p("authorizedAppsCount"))}
        />
        <Table.Column<TargetAppList>
          dataIndex="operation"
          fixed="right"
          title={t(p("operation"))}
          render={(_, r) => (
            <Space split={<Divider type="vertical" />}>
              <AuthorizeAppModalLink
                targetType={targetType}
                targetName={r.targetName}
                clusterId={clusterId}
                appsInfo={r.appsInfo}
                reload={reload}
              >
                {t(p("authorizeApp"))}
              </AuthorizeAppModalLink>
              <a onClick={() => setPreviewItem({
                targetName: r.targetName,
                clusterId,
                availableAppsCount: r.availableAppsCount,
                availableAppNames: r.appsInfo.filter((x) => !x.isDisabled).map((x) => x.appName),
                targetType,
              })}
              >
                {t(p("detail"))}
              </a>
            </Space>
          )}
        />
      </Table>
      <AppAuthInfoDrawer
        open={previewItem !== undefined}
        item={previewItem}
        onClose={() => setPreviewItem(undefined)}
      />
    </>
  );

};

