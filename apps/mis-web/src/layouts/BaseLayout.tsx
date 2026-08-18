import { UiExtensionStore } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { BaseLayout as LibBaseLayout } from "@scow/lib-web/build/layouts/base/BaseLayout";
import { HeaderNavbarLink } from "@scow/lib-web/build/layouts/base/header";
import { AiIcon, HighComputingIcon, MisIcon, QuantumIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { joinWithUrl } from "@scow/utils";
import { theme } from "antd";
import { join } from "path";
import { PropsWithChildren, useMemo } from "react";
import { useStore } from "simstate";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { getAvailableRoutes } from "src/layouts/routes";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";

interface Props {
  footerText: string | undefined;
  versionTag: string | undefined;
  initialLanguage: string;
}

export const BaseLayout = ({ footerText, versionTag, initialLanguage, children }: PropsWithChildren<Props>) => {
  const userStore = useStore(UserStore);
  const clusterStore = useStore(ClusterInfoStore);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const systemLanguageConfig = publicConfig.SYSTEM_LANGUAGE_CONFIG;

  const routes = useMemo(
    () => getAvailableRoutes(userStore.user, clusterStore.storageEnabled, t),
    [userStore.user, clusterStore.storageEnabled, t],
  );

  const uiExtensionStore = useStore(UiExtensionStore);

  const { useToken } = theme;
  const { token } = useToken();

  const toCallbackPage = (url: string) =>
    userStore.user ? join(url, `/api/auth/callback?token=${userStore.user.token}`) : url;

  const navbarLinks: HeaderNavbarLink[] = [
    {
      icon: <MisIcon style={{ paddingRight: 2, color: token.colorPrimary }} />,
      href: "",
      text: <span style={{ color: token.colorPrimary }}>{t("layouts.route.linkTextMis")}</span>,
      isActive: true,
    },
  ];

  if (publicConfig.PORTAL_URL) {
    navbarLinks.push({
      icon: <HighComputingIcon style={{ paddingRight: 2 }} />,
      href: toCallbackPage(publicConfig.PORTAL_URL),
      text: t("layouts.route.navLinkTextPortal"),
      crossSystem: true,
    });
  }

  if (publicConfig.AI_URL) {
    navbarLinks.push({
      icon: <AiIcon style={{ paddingRight: 2 }} />,
      href: publicConfig.AI_URL,
      text: t("layouts.route.navLinkTextAI"),
      crossSystem: true,
    });
  }

  if (publicConfig.QUANTUM_URL) {
    navbarLinks.push({
      icon: <QuantumIcon style={{ paddingRight: 2 }} />,
      href: publicConfig.QUANTUM_URL,
      text: t("layouts.route.navLinkTextQuantum"),
      crossSystem: true,
    });
  }

  return (
    <LibBaseLayout
      logout={userStore.logout}
      user={userStore.user}
      routes={routes}
      footerText={footerText}
      versionTag={versionTag}
      basePath={publicConfig.BASE_PATH}
      userLinks={publicConfig.USER_LINKS}
      from="mis"
      operationLogUrl={joinWithUrl(publicConfig.BASE_PATH, "/operationLog")}
      extensionStoreData={uiExtensionStore.data}
      languageId={languageId}
      headerNavbarLinks={navbarLinks}
      headerRightContent={
        systemLanguageConfig.isUsingI18n ? <LanguageSwitcher initialLanguage={initialLanguage} /> : undefined
      }
    >
      {children}
    </LibBaseLayout>
  );
};
