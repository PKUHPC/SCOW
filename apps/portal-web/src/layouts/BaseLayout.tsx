import { UiExtensionStore } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { BaseLayout as LibBaseLayout } from "@scow/lib-web/build/layouts/base/BaseLayout";
import { HeaderNavbarLink } from "@scow/lib-web/build/layouts/base/header";
import { AiIcon, HighComputingIcon, MisIcon, QuantumIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { theme } from "antd";
import { join } from "path";
import { PropsWithChildren } from "react";
import { useStore } from "simstate";
import { LanguageSwitcher } from "src/components/LanguageSwitcher";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { userRoutes } from "src/layouts/routes";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";

interface Props {
  footerText: string | undefined;
  versionTag: string | undefined;
  initialLanguage: string;
}

export const BaseLayout = ({ footerText, versionTag, initialLanguage, children }: PropsWithChildren<Props>) => {
  const userStore = useStore(UserStore);

  const {
    currentClusters,
    defaultCluster,
    setDefaultCluster,
    removeDefaultCluster,
    enableLoginDesktop,
    crossClusterFileTransferEnabled,
  } = useStore(ClusterInfoStore);

  const { loginNodes } = useStore(LoginNodeStore);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const systemLanguageConfig = publicConfig.SYSTEM_LANGUAGE_CONFIG;

  const routes = userRoutes(
    userStore.user,
    currentClusters,
    defaultCluster,
    loginNodes,
    enableLoginDesktop,
    crossClusterFileTransferEnabled,
    setDefaultCluster,
  );

  const uiExtensionStore = useStore(UiExtensionStore);

  const { useToken } = theme;
  const { token } = useToken();

  const logout = () => {
    removeDefaultCluster();
    userStore.logout();
  };

  const toCallbackPage = (url: string) =>
    userStore.user ? join(url, `/api/auth/callback?token=${userStore.user.token}`) : url;

  const navbarLinks: HeaderNavbarLink[] = [];

  if (publicConfig.MIS_URL) {
    navbarLinks.push({
      icon: <MisIcon style={{ paddingRight: 2 }} />,
      href: toCallbackPage(publicConfig.MIS_URL),
      text: t("baseLayout.linkTextMis"),
      crossSystem: true,
    });
  }

  navbarLinks.push({
    icon: <HighComputingIcon style={{ paddingRight: 2, color: token.colorPrimary }} />,
    href: "",
    text: <span style={{ color: token.colorPrimary }}>{t("baseLayout.linkTextHpc")}</span>,
    isActive: true,
  });

  if (publicConfig.AI_URL) {
    navbarLinks.push({
      icon: <AiIcon style={{ paddingRight: 2 }} />,
      href: publicConfig.AI_URL,
      text: t("baseLayout.linkTextAI"),
      crossSystem: true,
    });
  }

  if (publicConfig.QUANTUM_URL) {
    navbarLinks.push({
      icon: <QuantumIcon style={{ paddingRight: 2 }} />,
      href: publicConfig.QUANTUM_URL,
      text: t("baseLayout.linkTextQuantum"),
      crossSystem: true,
    });
  }

  return (
    <LibBaseLayout
      logout={logout}
      user={userStore.user}
      routes={routes}
      footerText={footerText}
      versionTag={versionTag}
      basePath={publicConfig.BASE_PATH}
      userLinks={publicConfig.USER_LINKS}
      languageId={languageId}
      extensionStoreData={uiExtensionStore.data}
      from="portal"
      headerNavbarLinks={navbarLinks}
      headerRightContent={
        systemLanguageConfig.isUsingI18n ? <LanguageSwitcher initialLanguage={initialLanguage} /> : undefined
      }
    >
      {children}
    </LibBaseLayout>
  );
};
