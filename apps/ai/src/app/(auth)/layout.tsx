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

import { DatabaseOutlined, DesktopOutlined } from "@ant-design/icons";
import React from "react";
import { useUserQuery } from "src/app/auth";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { Loading } from "src/components/Loading";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { BaseLayout } from "src/layouts/base/BaseLayout";
import { JumpToAnotherLink } from "src/layouts/base/header/Components";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";
import { trpc } from "src/utils/trpc";

import { useUiConfig } from "../uiContext";
import { PublicConfigContext } from "./context";
import { defaultClusterContext } from "./defaultClusterContext";
import { userRoutes } from "./routes";


const useConfigQuery = () => {
  return trpc.config.publicConfig.useQuery();
};

const useCurrentClusterIdsQuery = () => {
  return trpc.resource.getCurrentUserAssignedClusters.useQuery();
};

export default function Layout(
  { children }:
  { children: React.ReactNode },
) {

  const userQuery = useUserQuery();
  const configQuery = useConfigQuery();
  const currentClusterIdsQuery = useCurrentClusterIdsQuery();

  const languageId = useI18n().currentLanguage.id;

  if (userQuery.isLoading) {
    return (
      <BaseLayout>
        <Loading />
      </BaseLayout>
    );
  }

  if (userQuery.isError || !userQuery.data.user) {
    return;
  }

  if (configQuery.isLoading || currentClusterIdsQuery.isLoading) {
    return (
      <BaseLayout user={userQuery.data.user}>
        {children}
      </BaseLayout>
    );
  }

  if (configQuery.isError) {
    return (
      <BaseLayout>
        <ServerErrorPage />
      </BaseLayout>
    );
  }

  const publicConfig = configQuery.data;
  const { setDefaultCluster, defaultCluster, currentClusters }
   = defaultClusterContext(publicConfig.CLUSTERS, currentClusterIdsQuery?.data?.clusterIds ?? []);

  const { hostname, uiConfig } = useUiConfig();
  const footerConfig = uiConfig.config.footer;
  const footerText = (hostname && footerConfig?.hostnameMap?.[hostname])
    ?? footerConfig?.defaultText;

  const routes = userRoutes(userQuery.data.user, publicConfig, currentClusters, setDefaultCluster, defaultCluster);

  const t = useI18nTranslateToString();

  return (
    <BaseLayout
      routes={routes}
      user={userQuery.data.user}
      headerRightContent={(
        <>
          <JumpToAnotherLink
            user={userQuery.data.user}
            icon={<DatabaseOutlined style={{ paddingRight: 2 }} />}
            link={publicConfig.MIS_URL}
            linkText={t("baseLayout.linkTextMis")}
          />
          <JumpToAnotherLink
            user={userQuery.data.user}
            icon={<DesktopOutlined style={{ paddingRight: 2 }} />}
            link={publicConfig.PORTAL_URL}
            linkText="HPC"
          />
          {
            publicConfig.SYSTEM_LANGUAGE_CONFIG.isUsingI18n ? (
              <LanguageSwitcher initialLanguage={languageId} />
            ) : undefined
          }
        </>
      )}
      versionTag={publicConfig.VERSION_TAG}
      footerText={footerText}
    >
      <PublicConfigContext.Provider value={{
        user: userQuery.data.user,
        publicConfig,
        clusters: publicConfig.CLUSTERS,
        currentAssociateClusterIds: currentClusterIdsQuery?.data?.clusterIds ?? [],
        defaultClusterContext:
          defaultClusterContext(publicConfig.CLUSTERS ?? [], currentClusterIdsQuery?.data?.clusterIds ?? []),
      }}
      >
        {children}
      </PublicConfigContext.Provider>
    </BaseLayout>
  );

}
