/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

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

const { TabPane } = Tabs;

const p = prefix("page.user.historyJobs.");

export const JobsPage: NextPage = requireAuth((u) => u.accountAffiliations.length > 0)(
  ({ userStore }) => {

    const t = useI18nTranslateToString();

    const accountNames = useMemo(
      () => userStore.user.accountAffiliations.map((x) => x.accountName),
      [userStore.user.accountAffiliations]);

    return (
      <div>
        <Head title={t("common.historyJob")} />
        <PageTitle titleText={t(p("userCompletedJob"))} />

        {
          publicConfig.QUANTUM_URL ? (
            <Tabs defaultActiveKey="HPCAI">
              <TabPane tab={t("common.HPCAI")} key="HPCAI">
                <JobTable
                  accountNames={accountNames}
                  userId={userStore.user.identityId}
                  showAccount={true}
                  showUser={false}
                  filterUser={false}
                  showedPrices={["account"]}
                  priceTexts={{ account: t("common.jobBilling") }}
                />
              </TabPane>
              <TabPane tab={t("common.quantum")} key="quantum">
                <QuantumJobTable
                  userId={userStore.user.identityId}
                  showAccount={true}
                  showUser={false}
                  filterUserId={false}
                />
              </TabPane>
            </Tabs>
          ) : (
            <JobTable
              accountNames={accountNames}
              userId={userStore.user.identityId}
              showAccount={true}
              showUser={false}
              filterUser={false}
              showedPrices={["account"]}
              priceTexts={{ account: t("common.jobBilling") }}
            />
          )}
      </div>
    );

  });

export default JobsPage;
