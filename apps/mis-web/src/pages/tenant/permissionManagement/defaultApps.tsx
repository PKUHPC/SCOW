import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Space } from "antd";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { DefaultAppsTable } from "src/pageComponents/tenant/DefaultAppsTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

export const DefaultAppsPage: NextPage =
  requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(() => {

    if (!publicConfig.ALLOW_APP_AUTHORIZATION) {
      return <NotFoundPage />;
    }

    const t = useI18nTranslateToString();

    const promiseFn = useCallback(async () => {
      if (publicConfig.SCOW_RESOURCE_ENABLED) {
        const tenantAssignedClusterPartitions = await api.getTenantAssignedClustersAndPartitions({});
        return Object.keys(tenantAssignedClusterPartitions.assignedClusterPartitions);
      }
      return undefined;
    }, []);

    const { data: availableClusterIds, isLoading, reload } = useAsync({
      promiseFn,
      skip: !publicConfig.SCOW_RESOURCE_ENABLED,
    });

    if (publicConfig.SCOW_RESOURCE_ENABLED && !isLoading && availableClusterIds?.length === 0) {
      return <ClusterNotAvailablePage />;
    }

    return (
      <div>
        <Head title={t("page.tenant.permissionManagement.defaultApps.title")} />
        <PageTitle titleText={t("page.tenant.permissionManagement.defaultApps.title")} />
        <Space style={{ marginBottom: "20px" }}>
          <ExclamationCircleOutlined />
          <span>
            {t("page.tenant.permissionManagement.defaultApps.explanation")}
          </span>
        </Space>
        <DefaultAppsTable
          tenantAvailableClusterIds={availableClusterIds}
          loading={isLoading}
          reload={reload}
        />
      </div>
    );
  });

export default DefaultAppsPage;
