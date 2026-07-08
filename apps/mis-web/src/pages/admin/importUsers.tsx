import { Alert } from "antd";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { ImportUsersTable } from "src/pageComponents/admin/ImportUsersTable";
import { Head } from "src/utils/head";

const p = prefix("page.admin.importUsers.");

export const ImportUsersPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();
    return (
      <div>
        <Head title={t(p("importUserInfo"))} />
        <PageTitle titleText={t(p("importUserInfo"))} />
        <Alert
          type="info"
          style={{ marginBottom: "4px" }}
          showIcon
          message={
            <>
              <div>{t(p("importUserAlertInfo1"))}</div>
              <div>{t(p("importUserAlertInfo2"))}</div>
            </>
          }
        />
        <ImportUsersTable />
      </div>
    );
  },
);

export default ImportUsersPage;
