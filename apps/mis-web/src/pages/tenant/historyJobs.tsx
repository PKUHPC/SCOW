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
import { useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { QuantumJobTable } from "src/pageComponents/quantumJob/HistoryJobTable";
import { AdminJobTable } from "src/pageComponents/tenant/AdminJobTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

export const AdminJobsPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(
  () => {
    const t = useI18nTranslateToString();

    return (
      <div>
        <Head title={t("common.historyJob")} />
        <PageTitle titleText={t("common.finishedJobs")} />
        {
          publicConfig.QUANTUM_URL ? (
            <Tabs
              defaultActiveKey="HPCAI"
              items={[
                {
                  key: "HPCAI",
                  label: t("common.HPCAI"),
                  children: (
                    <AdminJobTable />
                  ),
                },
                {
                  key: "quantum",
                  label: t("common.quantum"),
                  children: (
                    <QuantumJobTable
                      showAccount={true}
                      showUser={true}
                    />
                  ),
                },
              ]}
            >
            </Tabs>
          ) : (
            <AdminJobTable />
          )}

      </div>
    );
  },
);

export default AdminJobsPage;
