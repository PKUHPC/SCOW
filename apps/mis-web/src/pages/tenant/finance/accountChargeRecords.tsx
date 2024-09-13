/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * OPENSCOW is licensed under Mulan PSL v2.
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
import { useI18nTranslateToString } from "src/i18n";
import { SearchType, TenantRole } from "src/models/User";
import { ChargeTable } from "src/pageComponents/finance/ChargeTable";
import { Head } from "src/utils/head";

export const TenantAccountsChargesPage: NextPage = requireAuth(
  (u) => u.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN))(
  () => {

    const t = useI18nTranslateToString();
    const title = t("page.tenant.finance.accountChargeRecords.title");

    return (
      <div>
        <Head title={title} />
        <PageTitle titleText={title}>
        </PageTitle>
        <ChargeTable
          showAccountName={true}
          showTenantName={false}
          searchType={SearchType.ACCOUNT}
        />
      </div>
    );
  });

export default TenantAccountsChargesPage;
