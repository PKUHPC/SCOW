import { SystemLanguageConfig } from "@scow/config/build/i18n";
import { BaseLayout as LibBaseLayout } from "@scow/lib-web/build/layouts/base/BaseLayout";
import { HeaderNavbarLink } from "@scow/lib-web/build/layouts/base/header";
import { AiIcon, HighComputingIcon, MisIcon, QuantumIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { UserInfo } from "@scow/lib-web/build/layouts/base/types";
import { DarkModeCookie, DarkModeProvider } from "@scow/lib-web/build/layouts/darkMode";
import { GlobalStyle } from "@scow/lib-web/build/layouts/globalStyle";
import { theme } from "antd";
import { join } from "path";
import React from "react";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { Provider, useI18n, useI18nTranslateToString } from "src/i18n";
import en from "src/i18n/en";
import zh_cn from "src/i18n/zh_cn";
import { AntdConfigProvider } from "src/layouts/AntdConfigProvider";
import { useRoutes } from "src/layouts/routes";
import { useUserQuery } from "src/utils/auth";
import { getSystemInitialLanguageId } from "src/utils/systemLanguage";
import { trpc } from "src/utils/trpc";

const languagesMap = {
  "zh_cn": zh_cn,
  "en": en,
};

const ClientLayoutLoaded = ({
  children, basePath, user, portalUrl, versionTag, languageConfig,
  initialLanguage, footerText, misUrl, aiUrl,
}: {
  children: React.ReactNode;
  basePath: string;
  user: UserInfo,
  portalUrl: string;
  misUrl: string;
  aiUrl: string;
  versionTag?: string;
  languageConfig: SystemLanguageConfig;
  initialLanguage: string,
  footerText?: string,
}) => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const routes = useRoutes(basePath, portalUrl);

  const logoutMutation = trpc.auth.logout.useMutation({});

  const toCallbackPage = (url: string) => user
    ? join(url, "/api/auth/callback?token=" + user.token)
    : url;

  const { useToken } = theme;
  const { token } = useToken();

  const navbarLinks: HeaderNavbarLink[] = [
    {
      icon: <QuantumIcon style={{ paddingRight: 2, color: token.colorPrimary }} />,
      href: "",
      text: <span style={{ color: token.colorPrimary }}>{t("route.linkTextQuantum")}</span>,
      isActive: true,
    },
    {
      icon: <HighComputingIcon style={{ paddingRight: 2 }} />,
      href: toCallbackPage(portalUrl),
      text: t("route.linkTextHpc"),
      crossSystem: true,
    },
    {
      icon: <MisIcon style={{ paddingRight: 2 }} />,
      href: toCallbackPage(misUrl),
      text: t("route.linkTextMis"),
      crossSystem: true,
    },
  ];

  if (aiUrl !== "") {
    navbarLinks.push({
      icon: <AiIcon style={{ paddingRight: 2 }} />,
      href: toCallbackPage(aiUrl),
      text: t("route.linkTextAI"),
      crossSystem: true,
    });
  }

  return (
    <LibBaseLayout
      logout={() => { logoutMutation.mutateAsync().then(() => { location.reload(); }); }}
      user={user}
      routes={routes}
      footerText={footerText}
      versionTag={versionTag}
      basePath={basePath}
      languageId={languageId}
      from="portal"
      headerNavbarLinks={navbarLinks}
      headerRightContent={(
        languageConfig.isUsingI18n ? (
          <LanguageSwitcher initialLanguage={initialLanguage} />
        ) : undefined
      )}
    >
      {children}
    </LibBaseLayout>
  );
};

export const ClientLayout = ({ children, dark, acceptLanguageHeader, languageCookie }: {
  children: React.ReactNode
  dark: DarkModeCookie | undefined,
  acceptLanguageHeader: string | null,
  languageCookie?: string | undefined,
}) => {
  const userQuery = useUserQuery();

  const publicConfigQuery = trpc.config.publicConfig.useQuery();

  if (userQuery.isLoading || publicConfigQuery.isLoading) {
    return (
      <body>
        <div>Loading...</div>
      </body>
    );
  }

  if (userQuery.isError || publicConfigQuery.isError) {
    return (
      <body>
        <div>Error loading user or configuration.</div>
      </body>
    );
  }

  const systemInitialLanguage = getSystemInitialLanguageId(
    languageCookie,
    acceptLanguageHeader,
    publicConfigQuery.data.systemLanguageConfig,
  );

  return (
    <DarkModeProvider initial={dark}>
      <Provider initialLanguage={{
        id: systemInitialLanguage,
        definitions: languagesMap[systemInitialLanguage as keyof typeof languagesMap],
      }}
      >
        <AntdConfigProvider
          primaryColor={{
            defaultColor: publicConfigQuery.data.uiConfig.defaultPrimaryColor,
            darkModeColor: publicConfigQuery.data.uiConfig.config.primaryColor?.darkModeColor,
          }}
          locale={systemInitialLanguage}
        >
          <GlobalStyle />
          <ClientLayoutLoaded
            basePath={publicConfigQuery.data.basePath}
            user={userQuery.data.user}
            portalUrl={publicConfigQuery.data.portalUrl}
            misUrl={publicConfigQuery.data.misUrl}
            languageConfig={publicConfigQuery.data.systemLanguageConfig}
            versionTag={publicConfigQuery.data.versionTag}
            initialLanguage={systemInitialLanguage}
            footerText={publicConfigQuery.data.footerText}
            aiUrl={publicConfigQuery.data.aiUrl}
          >
            {children}
          </ClientLayoutLoaded>
        </AntdConfigProvider>
      </Provider>
    </DarkModeProvider>
  );

};
