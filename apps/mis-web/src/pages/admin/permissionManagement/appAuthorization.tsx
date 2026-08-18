import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { AppAuthTargetType } from "src/models/app";
import { PlatformRole } from "src/models/User";
import { AppAuthorizationTable } from "src/pageComponents/common/appAuthorization/AppAuthorizationTable";
import { Head } from "src/utils/head";

export const AppAuthorizationPage: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();

    return (
      <div>
        <Head title={t("pageComp.commonComponent.appAuthorization.appAuthorizationTable.title")} />
        <PageTitle titleText={t("pageComp.commonComponent.appAuthorization.appAuthorizationTable.title")} />
        <AppAuthorizationTable targetType={AppAuthTargetType.TENANT} loading={false} />
      </div>
    );
  },
);

export default AppAuthorizationPage;
