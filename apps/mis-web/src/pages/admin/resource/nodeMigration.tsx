import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { NodeMigrationTable } from "src/pageComponents/admin/NodeMigrationTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

const nodeMigrationEnabled = publicConfig.NODE_MIGRATION?.enabled ? true : false;

export const NodeMigrationPage: NextPage = requireAuth(
  (u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && nodeMigrationEnabled,
)(() => {
  const t = useI18nTranslateToString();
  const p = prefix("page.admin.resourceManagement.nodeMigrationPage.");

  return (
    <div>
      <Head title={t(p("title"))} />
      <PageTitle titleText={t(p("title"))}></PageTitle>
      <NodeMigrationTable />
    </div>
  );
});

export default NodeMigrationPage;
