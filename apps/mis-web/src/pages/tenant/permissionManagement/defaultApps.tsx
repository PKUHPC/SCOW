import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Space } from "antd";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { DefaultAppsTable } from "src/pageComponents/tenant/DefaultAppsTable";
import { Head } from "src/utils/head";

export const DefaultAppsPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(() => {
  const t = useI18nTranslateToString();

  const promiseFn = useCallback(async () => {
    const tenantAssignedClusterPartitions = await api.getTenantAssignedClustersAndPartitions({});
    return Object.keys(tenantAssignedClusterPartitions.assignedClusterPartitions);
  }, []);

  const {
    data: availableClusterIds,
    isLoading,
    reload,
  } = useAsync({
    promiseFn,
  });

  if (!isLoading && availableClusterIds?.length === 0) {
    return <ClusterNotAvailablePage />;
  }

  return (
    <div>
      <Head title={t("page.tenant.permissionManagement.defaultApps.title")} />
      <PageTitle titleText={t("page.tenant.permissionManagement.defaultApps.title")} />
      <Space style={{ marginBottom: "20px" }}>
        <ExclamationCircleOutlined />
        <span>{t("page.tenant.permissionManagement.defaultApps.explanation")}</span>
      </Space>
      <DefaultAppsTable tenantAvailableClusterIds={availableClusterIds} loading={isLoading} reload={reload} />
    </div>
  );
});

export default DefaultAppsPage;
