import { Tabs } from "antd";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { QuantumJobTable } from "src/pageComponents/quantumJob/HistoryJobTable";
import { AdminJobTable } from "src/pageComponents/tenant/AdminJobTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

export const AdminHistoryJobsPage: NextPage = requireAuth((u) =>
  u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(() => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t("common.historyJob")} />
      <PageTitle titleText={t("common.finishedJobs")} />
      {publicConfig.QUANTUM_URL ? (
        <Tabs
          defaultActiveKey="HPCAI"
          items={[
            {
              key: "HPCAI",
              label: t("common.HPCAI"),
              children: <AdminJobTable platform={true} />,
            },
            {
              key: "quantum",
              label: t("common.quantum"),
              children: <QuantumJobTable platform={true} showAccount={true} showUser={true} />,
            },
          ]}
        ></Tabs>
      ) : (
        <AdminJobTable platform={true} />
      )}
    </div>
  );
});

export default AdminHistoryJobsPage;
