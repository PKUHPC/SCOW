import { ExclamationCircleOutlined } from "@ant-design/icons";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Input, Space, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { FilterFormContainer, FilterFormTabs } from "src/components/FilterFormContainer";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { UpdateDefaultAppAction } from "src/models/app";
import { TenantAppInfo } from "src/pages/api/tenant/authorization/getTenantApps";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { Cluster, getClusterName } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

import { AddToDefaultAppsButton } from "./AddToDefaultAppsButton";

interface FilterForm {
  appName: string | undefined;
}

interface Props {
  loading: boolean;
  tenantAvailableClusterIds?: string[];
  reload: () => void;
}

const p = prefix("pageComp.tenant.defaultApps.defaultAppsTable.");
export const DefaultAppsTable: React.FC<Props> = ({ tenantAvailableClusterIds, loading, reload }) => {

  const { activatedClusters, publicConfigClusters } = useStore(ClusterInfoStore);

  if (Object.keys(activatedClusters).length === 0) {
    return <ClusterNotAvailablePage />;
  }

  const userStore = useStore(UserStore);
  if (!userStore.user) {
    return <NotFoundPage />;
  }
  const tenantName = userStore.user.tenant;

  const [selectedClusterId, setSelectedClusterId] = useState<string>("");

  const availableClusters: Record<string, Cluster> = useMemo(() => {
    if (publicConfig.SCOW_RESOURCE_ENABLED) {
      const clusters = Object.entries(activatedClusters)
        .filter(([clusterId, _]) => tenantAvailableClusterIds?.includes(clusterId))
        .reduce((result, [clusterId, cluster]) => {
          result[clusterId] = cluster;
          return result;
        }, {});
      return clusters;
    }
    return activatedClusters;
  }, [activatedClusters, tenantAvailableClusterIds]);

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
    return { appName: undefined };
  });
  const { message, modal } = App.useApp();

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const [filterForm] = Form.useForm<FilterForm>();

  const promiseFn = useCallback(async () => {

    if (selectedClusterId === "") {
      return undefined;
    };

    return await api.getTenantApps({
      query: {
        clusterId: selectedClusterId,
      },
    });
  }, [selectedClusterId]);
  const { data, isLoading, reload: reloadDefaultApps } = useAsync({ promiseFn });

  // 前端过滤查询结果
  const filteredData = useMemo(() => {

    if (!data) return undefined;
    const defaultAppsData = data.tenantApps.filter((x) => (x.isDefault));
    if (!query.appName) {
      return defaultAppsData;
    }
    const filteredValues = defaultAppsData
      .filter((app) => app.name.toLowerCase().includes(query.appName?.toLowerCase() || ""));
    return filteredValues;

  }, [data, query]);

  const reloadTable = () => {
    reload();
    reloadDefaultApps();
  };

  const handleClusterChange = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    filterForm.resetFields();
    setQuery({ appName: undefined });
  };

  return (
    <div>

      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={filterForm}
          initialValues={query}
          onFinish={async () => {
            const { appName } = await filterForm.validateFields();
            setQuery({ appName: appName === "" ? undefined : appName?.trim() });
          }}
        >
          <FilterFormTabs
            tabs={Object.entries(availableClusters).map(([clusterId, cluster]) => ({
              title: `${getI18nConfigCurrentText(cluster.name, languageId) || clusterId}`,
              key: clusterId,
              node: (
                <>
                  <Form.Item
                    label={t(p("appName"))}
                    name="appName"
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">{t("common.search")}</Button>
                  </Form.Item>
                  <Space>
                    <AddToDefaultAppsButton
                      refresh={reloadTable}
                      defaultAppsData={data}
                      clusterId={selectedClusterId}
                      tenantName={tenantName}
                    />
                  </Space>
                </>
              ),
            }))}
            onChange={handleClusterChange}
          />
        </Form>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={isLoading || loading}
        scroll={{ x: true }}
      >
        <Table.Column<TenantAppInfo>
          dataIndex="name"
          title={t(p("appName"))}
        />
        <Table.Column<TenantAppInfo>
          dataIndex="operation"
          title={t(p("operation"))}
          render={(_, r) => (
            <Space>
              <Button
                type="link"
                onClick={() => {
                  const clusterName = getClusterName(selectedClusterId, languageId, publicConfigClusters);
                  modal.confirm({
                    title: t(p("removeFromDefaultApps.title")),
                    icon: <ExclamationCircleOutlined />,
                    content: (
                      <>
                        <p>
                          {t(p("removeFromDefaultApps.confirmContent"), [tenantName, clusterName, r.name])}
                        </p>
                        <p style={{ color: "red" }}>
                          {t(p("removeFromDefaultApps.confirmWarn"))}
                        </p>
                      </>
                    ),
                    onOk: async () => {
                      // 移出默认应用
                      await api.updateDefaultApp({
                        body: {
                          clusterId: selectedClusterId,
                          appId: r.id,
                          appName: r.name,
                          updateAction: UpdateDefaultAppAction.REMOVE_FROM_DEFAULT_APPS,
                        },
                      })
                        .then((res) => {
                          if (res.executed) {
                            message.success(t(p("removeFromDefaultApps.removeSuccessMessage")));
                            reloadTable();
                          } else {
                            message.error(res.reason || t(p("removeFromDefaultApps.removeFailedMessage")));
                          }
                        });
                    },
                  });
                }}
              >
                {t(p("removeFromDefaultApps.title"))}
              </Button>
            </Space>
          )}
        />
      </Table>
    </div>
  );
};
