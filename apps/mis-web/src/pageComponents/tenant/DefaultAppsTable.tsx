import { ExclamationCircleOutlined } from "@ant-design/icons";
import { RoundedSearch } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { compareNullableString } from "@scow/lib-web/build/utils/compareNullableValue";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { App, Button, Form, Table } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { AppScope, UpdateDefaultAppAction, YesOrNoColors } from "src/models/app";
import {
  AppScopeClusterToolbar,
  AuthorizationContent,
  useAppScopeClusterSelection,
} from "src/pageComponents/common/appAuthorization/AppScopeClusterToolbar";
import { TenantAppInfo } from "src/pages/api/tenant/authorization/getTenantApps";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

interface Props {
  tenantAvailableClusterIds?: string[];
  loading: boolean;
  reload: () => void;
}

interface FilterForm {
  appName?: string;
}

const p = prefix("pageComp.tenant.defaultApps.defaultAppsTable.");

export const DefaultAppsTable: React.FC<Props> = ({ tenantAvailableClusterIds, loading, reload }) => {
  const { activatedClusters } = useStore(ClusterInfoStore);
  const [appScope, setAppScope] = useState(AppScope.HPC);
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [query, setQuery] = useState<FilterForm>({});
  const [filterForm] = Form.useForm<FilterForm>();
  const { message, modal } = App.useApp();
  const t = useI18nTranslateToString();

  const availableClusters: Record<string, Cluster> = useMemo(() => {
    if (!publicConfig.SCOW_RESOURCE_ENABLED) return activatedClusters;
    return Object.fromEntries(
      Object.entries(activatedClusters).filter(([clusterId]) => tenantAvailableClusterIds?.includes(clusterId)),
    );
  }, [activatedClusters, tenantAvailableClusterIds]);

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
      .getTenantApps({ query: { clusterId: selectedClusterId, appScope } })
      .httpError(400, (error) => {
        message.error(error.message ?? t("common.finalError"));
      })
      .httpError(404, (error) => {
        message.error(error.message ?? t("common.finalError"));
      })
      .httpError(409, (error) => {
        message.error(error.message ?? t("common.finalError"));
      });
  }, [selectedClusterId, appScope]);
  const { data, isLoading, reload: reloadDefaultApps } = useAsync({ promiseFn });

  const filteredData = useMemo(() => {
    if (!query.appName) return data?.tenantApps;
    return data?.tenantApps.filter((app) => app.name.toLowerCase().includes(query.appName!.toLowerCase()));
  }, [data, query]);

  const resetFilter = () => {
    filterForm.resetFields();
    setQuery({});
  };

  const updateDefaultApp = (app: TenantAppInfo) => {
    const removing = app.isDefault;
    const updateAction = removing
      ? UpdateDefaultAppAction.REMOVE_FROM_DEFAULT_APPS
      : UpdateDefaultAppAction.ADD_TO_DEFAULT_APPS;

    modal.confirm({
      title: removing ? t(p("removeFromDefaultApps.title")) : t(p("addToDefaultApps.title")),
      width: 520,
      icon: <ExclamationCircleOutlined />,
      content: (
        <p style={{ color: "red" }}>
          {removing ? t(p("removeFromDefaultApps.confirmWarn")) : t(p("addToDefaultApps.confirmWarn"))}
        </p>
      ),
      onOk: async () => {
        const result = await api.updateDefaultApp({
          body: { clusterId: selectedClusterId, appScope, appId: app.id, appName: app.name, updateAction },
        });
        if (result.executed) {
          message.success(
            removing ? t(p("removeFromDefaultApps.removeSuccessMessage")) : t(p("addToDefaultApps.addSuccessMessage")),
          );
          reload();
          reloadDefaultApps();
        } else {
          message.error(
            result.reason ||
              (removing
                ? t(p("removeFromDefaultApps.removeFailedMessage"))
                : t(p("addToDefaultApps.addFailedMessage"))),
          );
        }
      },
    });
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
          resetFilter();
        }}
        onClusterChange={(clusterId) => {
          setSelectedClusterId(clusterId);
          resetFilter();
        }}
        search={
          <Form<FilterForm>
            form={filterForm}
            onFinish={(values) => setQuery({ appName: values.appName?.trim() || undefined })}
          >
            <Form.Item name="appName" noStyle>
              <RoundedSearch
                style={{ width: 320 }}
                $height="32px"
                placeholder={t(p("appName"))}
                enterButton
                onSearch={() => filterForm.submit()}
              />
            </Form.Item>
          </Form>
        }
      />
      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        rowKey="id"
        loading={isLoading || loading}
        scroll={{ x: true }}
        pagination={{ showSizeChanger: true, defaultPageSize: DEFAULT_PAGE_SIZE }}
      >
        <Table.Column<TenantAppInfo>
          dataIndex="name"
          title={t(p("appName"))}
          width="30%"
          sorter={(a, b) => compareNullableString(a.name, b.name)}
        />
        <Table.Column<TenantAppInfo>
          dataIndex="isDefault"
          title={t(p("isDefault"))}
          width="30%"
          render={(isDefault: boolean) => (
            <span style={{ color: isDefault ? YesOrNoColors.YES : YesOrNoColors.NO }}>
              {isDefault ? t(p("yes")) : t(p("no"))}
            </span>
          )}
        />
        <Table.Column<TenantAppInfo>
          dataIndex="operation"
          title={t(p("operation"))}
          width="40%"
          render={(_, app) => (
            <Button type="link" style={{ paddingInline: 0 }} onClick={() => updateDefaultApp(app)}>
              {app.isDefault ? t(p("removeAction")) : t("common.add")}
            </Button>
          )}
        />
      </Table>
    </AuthorizationContent>
  );
};
