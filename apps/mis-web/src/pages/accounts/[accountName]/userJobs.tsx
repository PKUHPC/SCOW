import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { requireAuth } from "src/auth/requireAuth";
import { BackButton } from "src/components/BackButton";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { UserRole } from "src/models/User";
import { JobTable } from "src/pageComponents/job/HistoryJobTable";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.userJob.");

export const UserJobsPage: NextPage = requireAuth((i) => i.accountAffiliations.some((x) => x.role !== UserRole.USER))(
  () => {
    const router = useRouter();
    const t = useI18nTranslateToString();

    const userId = queryToString(router.query.userId) || undefined;
    const accountName = queryToString(router.query.accountName) || "";

    const title = t(p("title"), [userId, accountName]);

    return (
      <div>
        <Head title={title} />
        <PageTitle beforeTitle={<BackButton href={`/accounts/${accountName}/users`} />} titleText={title} />
        <JobTable
          userId={userId}
          accountNames={accountName}
          showAccount={false}
          showUser={false}
          showedPrices={["account"]}
          priceTexts={{ account: t("common.jobBilling") }}
        />
      </div>
    );
  },
);

export default UserJobsPage;
