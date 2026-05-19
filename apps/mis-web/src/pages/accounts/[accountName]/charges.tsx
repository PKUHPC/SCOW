import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { UserRole } from "src/models/User";
import {
  checkQueryAccountNameIsAdmin,
  useAccountPagesAccountName,
} from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { ChargeTable } from "src/pageComponents/finance/ChargeTable";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.charges.");

export const ChargesPage: NextPage = requireAuth(
  (i) => i.accountAffiliations.some((x) => x.role !== UserRole.USER),
  checkQueryAccountNameIsAdmin,
)(() => {
  const t = useI18nTranslateToString();

  const accountName = useAccountPagesAccountName();

  const title = t(p("title"), [accountName]);

  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title}></PageTitle>
      <ChargeTable showAccountName={false} showTenantName={false} accountNames={[accountName]} />
    </div>
  );
});

export default ChargesPage;
