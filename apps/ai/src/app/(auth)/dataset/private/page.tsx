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

"use client";

import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";

import { DatasetListTable } from "../DatasetListTable";

export default function Page() {
  const t = useI18nTranslateToString();

  const { publicConfig, currentAssociateClusterIds } = usePublicConfig();

  return (
    <div>
      <PageTitle titleText={t("app.dataset.private")} />
      <DatasetListTable
        isPublic={false} 
        clusters={publicConfig.CLUSTERS}
        currentClusterIds={currentAssociateClusterIds}
      />
    </div>
  );
}
