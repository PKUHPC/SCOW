import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { OperationLogTable } from "src/components/OperationLogTable";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { OperationLogQueryType } from "src/models/operationLog";
import { Head } from "src/utils/head";

const p = prefix("page.user.operationLogs.");

export const OperationLogPage: NextPage = requireAuth(() => true)(({ userStore }) => {
  const t = useI18nTranslateToString();
  return (
    <div>
      <Head title={t("common.operationLog")} />
      <PageTitle titleText={t(p("userOperationLog"))} />
      <OperationLogTable queryType={OperationLogQueryType.USER} user={userStore.user} />
    </div>
  );
});

export default OperationLogPage;
