"use client";
import { Loading } from "@scow/lib-web/build/layouts/base/Loading";
import NotificationLayout from "@scow/lib-web/build/layouts/NotifLayout";
import { AdminMessageType, InternalMessageType } from "@scow/lib-web/build/models/notification";
import React from "react";
import { useUserQuery } from "src/app/auth";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { useI18n, useI18nTranslateToString } from "src/i18n";
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const userQuery = useUserQuery();
  const configQuery = useConfigQuery();
  const scowClusterConfigsQuery = useScowClusterConfigsQuery();
  const currentClusterIdsQuery = useCurrentClusterIdsQuery();
  const unreadMessagesQuery = trpc.notification.getUnreadMessages.useQuery(
    {
      messageTypes: [AdminMessageType.SystemNotification, InternalMessageType.MonitorAlert],
    },
    {
      enabled: !!configQuery.data?.NOTIF_ENABLED,
    },
  );

  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const { hostname, uiConfig } = useUiConfig();

  const createAppSessionMutation = trpc.notification.markMessageRead.useMutation({});

  if (userQuery.isLoading) {
    return <Loading />;
  }

  if (userQuery.isError || !userQuery.isSuccess || !userQuery.data.user) {
    return;
  }

  if (configQuery.isLoading || currentClusterIdsQuery.isLoading || scowClusterConfigsQuery.isLoading) {
    return <BaseLayout user={userQuery.data.user}>{children}</BaseLayout>;
  }

  if (
    configQuery.isError ||
    scowClusterConfigsQuery.isError ||
    !configQuery.isSuccess ||
    !scowClusterConfigsQuery.isSuccess
  ) {
    return (
      <BaseLayout>
        <ServerErrorPage />
      </BaseLayout>
    );
  }

  const publicConfig = configQuery.data;
  const scowClusterConfigs = scowClusterConfigsQuery.data;
  const { currentClusters } = defaultClusterContext(
    publicConfig.CLUSTERS,
    currentClusterIdsQuery?.data?.clusterIds ?? [],
  );

  const footerConfig = uiConfig.config?.footer;
  const footerText = (hostname && footerConfig?.hostnameMap?.[hostname]) ?? footerConfig?.defaultText;

  const routes = userRoutes(userQuery.data.user, publicConfig, scowClusterConfigs, currentClusters, t);

  return (
    <PublicConfigContext.Provider
      value={{
        user: userQuery.data.user,
        publicConfig,
        clusters: publicConfig.CLUSTERS,
        scowClusterConfigs,
        currentAvailableClusterIds: currentClusterIdsQuery?.data?.clusterIds ?? [],
        defaultClusterContext: defaultClusterContext(
          publicConfig.CLUSTERS ?? [],
          currentClusterIdsQuery?.data?.clusterIds ?? [],
        ),
      }}
    >
      <BaseLayout
        routes={routes}
        user={userQuery.data.user}
        headerRightContent={
          <>
            <SystemSelect user={userQuery.data.user} publicConfig={publicConfig}></SystemSelect>
            {publicConfig.SYSTEM_LANGUAGE_CONFIG.isUsingI18n ? (
              <LanguageSwitcher initialLanguage={languageId} />
            ) : undefined}
          </>
        }
        versionTag={publicConfig.VERSION_TAG}
        footerText={footerText}
      >
        {publicConfig.NOTIF_ENABLED ? (
          <NotificationLayout
            interval={300000}
            languageId={languageId}
            onMarkMessageRead={async (messageId: number) => {
              await createAppSessionMutation.mutateAsync({ messageId });
            }}
            fetchUnreadMessages={async () => unreadMessagesQuery.data?.results}
          >
            {children}
          </NotificationLayout>
        ) : (
          children
        )}
      </BaseLayout>
    </PublicConfigContext.Provider>
  );
}
