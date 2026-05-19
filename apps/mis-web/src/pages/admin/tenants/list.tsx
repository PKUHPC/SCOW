import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { Divider, Space } from "antd";
import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { AllTenantsTable } from "src/pageComponents/admin/AllTenantsTable";
import { Head } from "src/utils/head";

export const showAllTenants: NextPage = requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;

    const [refreshToken, update] = useRefreshToken();
    return (
      <div>
        <Head title={t("common.tenantList")} />
        <PageTitle titleText={t("common.tenantList")}>
          <Space split={<Divider type="vertical" />}>
            <RefreshLink refresh={update} languageId={languageId} />
          </Space>
        </PageTitle>
        <AllTenantsTable refreshToken={refreshToken} />
      </div>
    );
  },
);
export default showAllTenants;
