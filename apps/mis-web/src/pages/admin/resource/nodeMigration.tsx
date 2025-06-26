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
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { NodeMigrationTable } from "src/pageComponents/admin/NodeMigrationTable";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";

const nodeMigrationEnabled = publicConfig.NODE_MIGRATION?.enabled ? true : false;

export const NodeMigrationPage: NextPage =
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && nodeMigrationEnabled)(() => {

    const t = useI18nTranslateToString();
    const p = prefix("page.admin.resourceManagement.nodeMigrationPage.");

    return (
      <div>
        <Head title={t(p("title"))} />
        <PageTitle titleText={t(p("title"))}>
        </PageTitle>
        <NodeMigrationTable />
      </div>
    );

  });

export default NodeMigrationPage;
