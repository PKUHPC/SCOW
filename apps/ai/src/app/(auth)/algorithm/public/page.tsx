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
import { AlgorithmTable } from "src/app/(auth)/algorithm/AlgorithmTable";
import { usePublicConfig } from "src/app/(auth)/context";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";

export default function Page() {

  const { publicConfig } = usePublicConfig();
  const t = useI18nTranslateToString();

  return (
    <div>
      <PageTitle titleText={t("app.algorithm.public")} />
      <AlgorithmTable isPublic={true} clusters={publicConfig.CLUSTERS} />
    </div>
  );
}
