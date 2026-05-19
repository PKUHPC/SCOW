import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { OperationLogTable } from "src/components/OperationLogTable";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslate, useI18nTranslateToString } from "src/i18n";
import { OperationLogQueryType } from "src/models/operationLog";
import {
  checkQueryAccountNameIsAdmin,
  useAccountPagesAccountName,
} from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.operationLog.");

export const OperationLogPage: NextPage = requireAuth(
  (u) => u.accountAffiliations.length > 0,
  checkQueryAccountNameIsAdmin,
)(({ userStore }) => {
  const tArgs = useI18nTranslate();

  const accountName = useAccountPagesAccountName();

  const t = useI18nTranslateToString();

  const title = tArgs(p("title"), [accountName]);
  return (
    <div>
      <Head title={t("common.operationLog")} />
      <PageTitle titleText={title} />
      <OperationLogTable queryType={OperationLogQueryType.ACCOUNT} user={userStore.user} accountName={accountName} />
    </div>
  );
});

export default OperationLogPage;
