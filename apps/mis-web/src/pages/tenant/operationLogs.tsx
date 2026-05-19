import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { OperationLogTable } from "src/components/OperationLogTable";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { OperationLogQueryType } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { Head } from "src/utils/head";

export const OperationLogPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(({
  userStore,
}) => {
  const t = useI18nTranslateToString();

  const tenant = userStore.user.tenant;
  const title = `${t("common.tenant")}${tenant}${t("common.operationLog")}`;
  return (
    <div>
      <Head title={t("common.operationLog")} />
      <PageTitle titleText={title} />
      <OperationLogTable queryType={OperationLogQueryType.TENANT} user={userStore.user} tenantName={tenant} />
    </div>
  );
});

export default OperationLogPage;
