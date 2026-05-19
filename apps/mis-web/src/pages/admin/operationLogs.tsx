import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { OperationLogTable } from "src/components/OperationLogTable";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { OperationLogQueryType } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { Head } from "src/utils/head";

const p = prefix("page.admin.operationLogs.");

export const OperationLogPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(({
  userStore,
}) => {
  const t = useI18nTranslateToString();
  const title = t(p("platformOperationLog"));
  return (
    <div>
      <Head title={t("common.operationLog")} />
      <PageTitle titleText={title} />
      <OperationLogTable queryType={OperationLogQueryType.PLATFORM} user={userStore.user} />
    </div>
  );
});

export default OperationLogPage;
