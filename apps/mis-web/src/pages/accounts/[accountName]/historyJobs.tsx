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

const { TabPane } = Tabs;

const p = prefix("page.accounts.accountName.historyJobs.");

export const HistoryJobsPage: NextPage = requireAuth(
  (u) => u.accountAffiliations.length > 0,
  checkQueryAccountNameIsAdmin,
)(
  () => {
    const t = useI18nTranslateToString();
    const accountName = useAccountPagesAccountName();

    const title = t(p("title"), [accountName]);
    return (
      <div>
        <Head title={title} />
        <PageTitle titleText={title} />
        {
          publicConfig.QUANTUM_URL ? (
            <Tabs defaultActiveKey="HPCAI">
              <TabPane tab={t("common.HPCAI")} key="HPCAI">
                <JobTable
                  accountNames={accountName}
                  filterAccountName={false}
                  showAccount={false}
                  showUser={true}
                  showedPrices={["account"]}
                  priceTexts={{ account: t("common.jobBilling") }}
                />
              </TabPane>
              <TabPane tab={t("common.quantum")} key="quantum">
                <QuantumJobTable
                  accountName={accountName}
                  filterAccountName={false}
                  showAccount={false}
                  showUser={true}
                />
              </TabPane>
            </Tabs>
          )
            : (
              <JobTable
                accountNames={accountName}
                filterAccountName={false}
                showAccount={false}
                showUser={true}
                showedPrices={["account"]}
                priceTexts={{ account: t("common.jobBilling") }}
              />
            )
        }

      </div>

    );

  });

export default HistoryJobsPage;
