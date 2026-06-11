import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { OperationLogTable } from "src/components/OperationLogTable";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { OperationLogQueryType } from "src/models/operationLog";
import { PlatformRole, TenantRole } from "src/models/User";
import { Head } from "src/utils/head";

export const OperationLogPage: NextPage = requireAuth(() => true)(({ userStore }) => {
  const t = useI18nTranslateToString();
  const { user } = userStore;

  const queryType = user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
    ? OperationLogQueryType.PLATFORM
    : user.tenantRoles.includes(TenantRole.TENANT_ADMIN)
      ? OperationLogQueryType.TENANT
      : OperationLogQueryType.USER;

  const tenantName = queryType === OperationLogQueryType.TENANT ? user.tenant : undefined;

  return (
    <div>
      <Head title={t("common.operationLog")} />
      <PageTitle titleText={t("common.operationLog")} />
      <OperationLogTable queryType={queryType} user={user} tenantName={tenantName} />
    </div>
  );
});

export default OperationLogPage;
