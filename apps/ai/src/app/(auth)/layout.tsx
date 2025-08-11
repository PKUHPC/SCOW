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

import React from "react";
import { useUserQuery } from "src/app/auth";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { Loading } from "src/components/Loading";
import { useI18n } from "src/i18n";
import { BaseLayout } from "src/layouts/base/BaseLayout";
import { SystemSelect } from "src/layouts/base/header/SystemSelect";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";
import { trpc } from "src/utils/trpc";

import { useUiConfig } from "../uiContext";
import { PublicConfigContext } from "./context";
import { defaultClusterContext } from "./defaultClusterContext";
import { userRoutes } from "./routes";

const useConfigQuery = () => {
  return trpc.config.publicConfig.useQuery();
};

const useScowClusterConfigsQuery = () => {
  return trpc.config.getScowClusterConfig.useQuery();
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
  const scowClusterConfigsQuery = useScowClusterConfigsQuery();
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

  if (configQuery.isLoading || currentClusterIdsQuery.isLoading || scowClusterConfigsQuery.isLoading) {
    return (
      <BaseLayout user={userQuery.data.user}>
        {children}
      </BaseLayout>
    );
  }

  if (configQuery.isError || scowClusterConfigsQuery.isError) {
    return (
      <BaseLayout>
        <ServerErrorPage />
      </BaseLayout>
    );
  }

  const publicConfig = configQuery.data;
  const scowClusterConfigs = scowClusterConfigsQuery.data;
  const { setDefaultCluster, defaultCluster, currentClusters }
   = defaultClusterContext(publicConfig.CLUSTERS, currentClusterIdsQuery?.data?.clusterIds ?? []);

  const { hostname, uiConfig } = useUiConfig();
  const footerConfig = uiConfig.config.footer;
  const footerText = (hostname && footerConfig?.hostnameMap?.[hostname])
    ?? footerConfig?.defaultText;

  const routes = userRoutes(userQuery.data.user, publicConfig, currentClusters, setDefaultCluster, defaultCluster);

  return (
    <PublicConfigContext.Provider value={{
      user: userQuery.data.user,
      publicConfig,
      clusters: publicConfig.CLUSTERS,
      scowClusterConfigs,
      currentAssociateClusterIds: currentClusterIdsQuery?.data?.clusterIds ?? [],
      defaultClusterContext:
          defaultClusterContext(publicConfig.CLUSTERS ?? [], currentClusterIdsQuery?.data?.clusterIds ?? []),
    }}
    >
      <BaseLayout
        routes={routes}
        user={userQuery.data.user}
        headerRightContent={(
          <>
            <SystemSelect
              user={userQuery.data.user}
              publicConfig={publicConfig}
            ></SystemSelect>
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

        {children}
      </BaseLayout>
    </PublicConfigContext.Provider>
  );
}
