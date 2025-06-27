import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { TenantStorageManagerTable } from "src/pageComponents/storage/TenantStorageManagerTable";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.storageManager.");

export const StorageManagerPage: NextPage = requireAuth((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(
  () => {
    const t = useI18nTranslateToString();

    return (
      <div>
        <Head title={t(p("storageManager"))} />
        <PageTitle titleText={t(p("storageManager"))} />
        <TenantStorageManagerTable />
      </div>
    );

  });

export default StorageManagerPage;
