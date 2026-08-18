import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { AppAuthTargetType } from "src/models/app";
import { TenantRole } from "src/models/User";
import { AppAuthorizationTable } from "src/pageComponents/common/appAuthorization/AppAuthorizationTable";
import { Head } from "src/utils/head";

export const AppAuthorizationPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(
  () => {
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
        <Head title={t("pageComp.commonComponent.appAuthorization.appAuthorizationTable.title")} />
        <PageTitle titleText={t("pageComp.commonComponent.appAuthorization.appAuthorizationTable.title")} />
        <AppAuthorizationTable
          targetType={AppAuthTargetType.ACCOUNT}
          tenantAvailableClusterIds={availableClusterIds}
          loading={isLoading}
          reload={reload}
        />
      </div>
    );
  },
);

export default AppAuthorizationPage;
