import { GetServerSideProps, NextPage } from "next";
import { AuthResultError, ssrAuthenticate } from "src/auth/server";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { Redirect } from "src/components/Redirect";
import { useI18nTranslateToString } from "src/i18n";
import { accountAdminRoutes } from "src/layouts/routes";
import { AccountAffiliation, UserRole } from "src/models/User";
import { AccountState } from "src/models/User";

interface Props {
  error: AuthResultError;
  adminAccounts?: AccountAffiliation[];
}

export const FinanceIndexPage: NextPage<Props> = ({ error, adminAccounts }) => {
  const t = useI18nTranslateToString();

  if (error) {
    return <UnifiedErrorPage code={error} />;
  }
  if (adminAccounts) {
    return <Redirect url={accountAdminRoutes(adminAccounts, t)[0].children![0].children![0].path} />;
  }
};

const auth = ssrAuthenticate((u) =>
  u.accountAffiliations.some((x) => x.role !== UserRole.USER && x.accountState !== AccountState.DELETED),
);

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const info = await auth(ctx.req);

  if (typeof info === "number") {
    return { props: { error: info } };
  }

  const adminAccounts = info.accountAffiliations.filter((x) => x.role !== UserRole.USER);

  return { props: { adminAccounts } };
};

export default FinanceIndexPage;
