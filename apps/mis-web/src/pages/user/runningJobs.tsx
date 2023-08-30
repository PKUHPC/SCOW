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

import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { RunningJobQueryTable } from "src/pageComponents/job/RunningJobTable";
import { Head } from "src/utils/head";
import useI18nTranslateToString from "src/utils/useI18nTranslateToString";

export const RunningJobsPage: NextPage = requireAuth((u) => u.accountAffiliations.length > 0)(
  ({ userStore }) => {
    const { t } = useI18nTranslateToString();
    return (
      <div>
        <Head title={t("runningJob.title")} />
        <PageTitle titleText={t("runningJob.title")} />
        <RunningJobQueryTable
          userId={userStore.user.identityId}
          accountNames={userStore.user.accountAffiliations.map((x) => x.accountName)}
          showAccount={true}
          showUser={false}
        />
      </div>

    );

  });

export default RunningJobsPage;
