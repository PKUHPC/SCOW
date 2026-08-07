import { Tabs } from "antd";
import { NextPage } from "next";
import { useMemo } from "react";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { JobTable } from "src/pageComponents/job/HistoryJobTable";
import { QuantumJobTable } from "src/pageComponents/quantumJob/HistoryJobTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

const p = prefix("page.user.historyJobs.");

export const JobsPage: NextPage = requireAuth((u) => u.accountAffiliations.length > 0)(({ userStore }) => {
  const t = useI18nTranslateToString();

  const accountNames = useMemo(
    () => userStore.user.accountAffiliations.map((x) => x.accountName),
    [userStore.user.accountAffiliations],
  );

  return (
    <div>
      <Head title={t("common.historyJob")} />
      <PageTitle titleText={t(p("userCompletedJob"))} />

      {publicConfig.QUANTUM_URL ? (
        <Tabs
          defaultActiveKey="HPCAI"
          items={[
            {
              key: "HPCAI",
              label: t("common.HPCAI"),
              children: (
                <JobTable
                  accountNames={accountNames}
                  tenantName={userStore.user.tenant}
                  userId={userStore.user.identityId}
                  showAccount={true}
                  showUser={false}
                  showOwner={true}
                  filterUser={false}
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
                  userId={userStore.user.identityId}
                  tenantName={userStore.user.tenant}
                  showAccount={true}
                  showUser={false}
                  filterUserId={false}
                />
              ),
            },
          ]}
        ></Tabs>
      ) : (
        <JobTable
          accountNames={accountNames}
          tenantName={userStore.user.tenant}
          userId={userStore.user.identityId}
          showAccount={true}
          showUser={false}
          showOwner={true}
          filterUser={false}
          showedPrices={["account"]}
          priceTexts={{ account: t("common.jobBilling") }}
        />
      )}
    </div>
  );
});

export default JobsPage;
