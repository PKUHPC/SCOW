import type { GetTargetAppAuthorizationsSchema } from "src/pages/api/admin/authorization/getTargetAppAuthorizations";

import { RoundedSearch } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { SelectSearch } from "@scow/lib-web/build/components/styledAntdCom/SelectSearch";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { TargetAppList } from "@scow/protos/build/server/app_authorization";
import { Static } from "@sinclair/typebox";
import { App, Divider, Form, Input, Space, Table } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppAuthTargetType, AppScope } from "src/models/app";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

import { AppAuthInfoDrawer, TargetAppsDrawerItem } from "./AppAuthInfoDrawer";
import {
  AppScopeClusterToolbar,
  AuthorizationContent,
  useAppScopeClusterSelection,
} from "./AppScopeClusterToolbar";
import { AuthorizeAppModalLink } from "./AuthorizeAppModal";

enum AccountSearchType {
  ACCOUNT = "ACCOUNT",
  OWNER = "OWNER",
}

interface FilterForm {
  keyword?: string;
  searchType: AccountSearchType;
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
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [appScope, setAppScope] = useState(AppScope.HPC);
  const [query, setQuery] = useState<FilterForm>({ searchType: AccountSearchType.ACCOUNT });
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [filterForm] = Form.useForm<FilterForm>();
  const selectedSearchType = Form.useWatch("searchType", filterForm) ?? AccountSearchType.ACCOUNT;
  const { message } = App.useApp();
  const t = useI18nTranslateToString();

  const availableClusters: Record<string, Cluster> = useMemo(() => {
    if (targetType === AppAuthTargetType.ACCOUNT && publicConfig.SCOW_RESOURCE_ENABLED) {
      return Object.fromEntries(
        Object.entries(activatedClusters).filter(([clusterId]) => tenantAvailableClusterIds?.includes(clusterId)),
      );
    }
    return activatedClusters;
  }, [targetType, activatedClusters, tenantAvailableClusterIds]);

  // 根据已部署的平台纠正当前范围，并在当前集群不可用时选择该平台下的首个可用集群。
  useAppScopeClusterSelection({
    availableClusters,
    appScope,
    setAppScope,
    selectedClusterId,
    setSelectedClusterId,
  });

  const promiseFn = useCallback(async () => {
    if (!selectedClusterId) return undefined;
    return await api
      .getTargetAppAuthorizations({
        query: {
          page: pageInfo.page,
          pageSize: pageInfo.pageSize,
          clusterId: selectedClusterId,
          appScope,
          targetType,
          filterTargetName:
            targetType === AppAuthTargetType.TENANT || query.searchType === AccountSearchType.ACCOUNT
              ? query.keyword
              : undefined,
          filterAccountOwnerIdOrName:
            targetType === AppAuthTargetType.ACCOUNT && query.searchType === AccountSearchType.OWNER
              ? query.keyword
              : undefined,
        },
      })
      .httpError(400, (error) => {
        message.error(error.message ?? t("common.finalError"));
      })
      .httpError(404, (error) => {
        message.error(error.message ?? t("common.finalError"));
      })
      .httpError(409, (error) => {
        message.error(error.message ?? t("common.finalError"));
      });
  }, [query, pageInfo, selectedClusterId, appScope, targetType]);
  const { data, isLoading, reload: reloadTargetAppList } = useAsync({ promiseFn });

  const resetFilters = () => {
    filterForm.setFieldsValue({ keyword: undefined, searchType: AccountSearchType.ACCOUNT });
    setQuery({ searchType: AccountSearchType.ACCOUNT });
    setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
  };

  return (
    <AuthorizationContent>
      <AppScopeClusterToolbar
        availableClusters={availableClusters}
        appScope={appScope}
        selectedClusterId={selectedClusterId}
        onScopeChange={(scope) => {
          setAppScope(scope);
          setSelectedClusterId("");
          resetFilters();
        }}
        onClusterChange={(clusterId) => {
          setSelectedClusterId(clusterId);
          resetFilters();
        }}
        searchWidth={targetType === AppAuthTargetType.ACCOUNT ? 460 : 360}
        search={
          <Form<FilterForm>
            form={filterForm}
            initialValues={query}
            onFinish={(values) => {
              setQuery({ ...values, keyword: values.keyword?.trim() || undefined });
              setPageInfo({ page: 1, pageSize: pageInfo.pageSize });
            }}
          >
            <Form.Item name="searchType" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="keyword" noStyle>
              {targetType === AppAuthTargetType.ACCOUNT ? (
                <SelectSearch
                  width={460}
                  $height="32px"
                  labelValue={selectedSearchType}
                  labelOptions={[
                    { label: t(p("account")), value: AccountSearchType.ACCOUNT },
                    { label: t(p("accountOwner")), value: AccountSearchType.OWNER },
                  ]}
                  onLabelChange={(value) => {
                    filterForm.setFieldsValue({ searchType: value, keyword: undefined });
                  }}
                  placeholder={
                    selectedSearchType === AccountSearchType.OWNER ? t(p("accountOwnerPlaceholder")) : undefined
                  }
                  enterButton
                  onSearch={() => filterForm.submit()}
                />
              ) : (
                <RoundedSearch
                  style={{ width: 360 }}
                  $height="32px"
                  placeholder={t(p("tenant"))}
                  enterButton
                  onSearch={() => filterForm.submit()}
                />
              )}
            </Form.Item>
          </Form>
        }
      />
      <AppAuthorizationInfoTable
        clusterId={selectedClusterId}
        appScope={appScope}
        targetType={targetType}
        data={data}
        pageInfo={pageInfo}
        setPageInfo={setPageInfo}
        isLoading={isLoading || loading}
        reload={() => {
          reload?.();
          reloadTargetAppList();
        }}
      />
    </AuthorizationContent>
  );
};

interface AppAuthorizationInfoTableProps {
  clusterId: string;
  appScope: AppScope;
  targetType: AppAuthTargetType;
  data?: Static<(typeof GetTargetAppAuthorizationsSchema)["responses"]["200"]>;
  pageInfo: PageInfo;
  setPageInfo: (info: PageInfo) => void;
  isLoading: boolean;
  reload: () => void;
}

const AppAuthorizationInfoTable: React.FC<AppAuthorizationInfoTableProps> = ({
  clusterId,
  appScope,
  targetType,
  data,
  pageInfo,
  setPageInfo,
  isLoading,
  reload,
}) => {
  const t = useI18nTranslateToString();
  const [previewItem, setPreviewItem] = useState<TargetAppsDrawerItem>();

  return (
    <>
      <Table
        tableLayout="fixed"
        dataSource={data?.appLists}
        rowKey="targetName"
        loading={isLoading}
        pagination={{
          current: pageInfo.page,
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSize: pageInfo.pageSize,
          showSizeChanger: true,
          total: data?.totalCount,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
        scroll={{ x: true }}
      >
        <Table.Column<TargetAppList>
          dataIndex="targetName"
          title={targetType === AppAuthTargetType.TENANT ? t(p("tenant")) : t(p("account"))}
        />
        {targetType === AppAuthTargetType.ACCOUNT && (
          <Table.Column<TargetAppList>
            dataIndex="accountOwnerId"
            title={t(p("accountOwner"))}
            render={(_, r) => `${r.accountOwnerName}（ID: ${r.accountOwnerId}）`}
          />
        )}
        <Table.Column<TargetAppList> dataIndex="availableAppsCount" title={t(p("authorizedAppsCount"))} />
        <Table.Column<TargetAppList>
          dataIndex="operation"
          fixed="right"
          title={t(p("operation"))}
          render={(_, r) => (
            <Space split={<Divider type="vertical" />}>
              <AuthorizeAppModalLink
                targetType={targetType}
                targetName={r.targetName}
                accountOwnerId={r.accountOwnerId}
                accountOwnerName={r.accountOwnerName}
                clusterId={clusterId}
                appScope={appScope}
                appsInfo={r.appsInfo}
                reload={reload}
              >
                {t(p("authorizeApp"))}
              </AuthorizeAppModalLink>
              <a
                onClick={() =>
                  setPreviewItem({
                    targetName: r.targetName,
                    clusterId,
                    availableAppsCount: r.availableAppsCount,
                    availableAppNames: r.appsInfo.filter((app) => !app.isDisabled).map((app) => app.appName),
                    accountOwner: r.accountOwnerId
                      ? { accountOwnerId: r.accountOwnerId, accountOwnerName: r.accountOwnerName ?? "-" }
                      : undefined,
                    targetType,
                  })
                }
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
