import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { AllUsersTable } from "src/pageComponents/admin/AllUsersTable";
import { Head } from "src/utils/head";



export const ShowUsersPage: NextPage =
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(({ userStore: { user } }) => {

    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;
    const [refreshToken, update] = useRefreshToken();

    return (
      <div>
        <Head title={t("common.userList")} />
        <PageTitle titleText={t("common.userList")}>
          <RefreshLink refresh={update} languageId={languageId} />
        </PageTitle>
        <AllUsersTable
          refreshToken={refreshToken}
          user={user}
        />
      </div>
    );
  });

export default ShowUsersPage;
