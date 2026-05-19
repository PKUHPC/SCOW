import { Tabs } from "antd";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import {
  checkQueryAccountNameIsAdmin,
  useAccountPagesAccountName,
} from "src/pageComponents/accounts/checkQueryAccountNameIsAdmin";
import { JobTable } from "src/pageComponents/job/HistoryJobTable";
import { QuantumJobTable } from "src/pageComponents/quantumJob/HistoryJobTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

const p = prefix("page.accounts.accountName.historyJobs.");

export const HistoryJobsPage: NextPage = requireAuth(
  (u) => u.accountAffiliations.length > 0,
  checkQueryAccountNameIsAdmin,
)(() => {
  const t = useI18nTranslateToString();
  const accountName = useAccountPagesAccountName();

  const title = t(p("title"), [accountName]);
  return (
    <div>
      <Head title={title} />
      <PageTitle titleText={title} />
      {publicConfig.QUANTUM_URL ? (
        <Tabs
          defaultActiveKey="HPCAI"
          items={[
            {
              key: "HPCAI",
              label: t("common.HPCAI"),
              children: (
                <JobTable
                  accountNames={accountName}
                  filterAccountName={false}
                  showAccount={false}
                  showUser={true}
                  showedPrices={["account"]}
                  priceTexts={{ account: t("common.jobBilling") }}
                />
              ),
            },
            {
              key: "quantum",
              label: t("common.quantum"),
              children: (
                <QuantumJobTable
                  accountName={accountName}
                  filterAccountName={false}
                  showAccount={false}
                  showUser={true}
                />
              ),
            },
          ]}
        ></Tabs>
      ) : (
        <JobTable
          accountNames={accountName}
          filterAccountName={false}
          showAccount={false}
          showUser={true}
          showedPrices={["account"]}
          priceTexts={{ account: t("common.jobBilling") }}
        />
      )}
    </div>
  );
});

export default HistoryJobsPage;
