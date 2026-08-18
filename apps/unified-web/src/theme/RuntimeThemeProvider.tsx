import { App as AntdApp, ConfigProvider } from "antd";
import { PropsWithChildren, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMetadataQuery } from "src/api/metadata";
import { useUiConfigQuery } from "src/api/uiConfig";
import { getLanguageDefinition, isSupportedLanguage } from "src/i18n/languages";
import { createStyledTheme, resolvePrimaryColor } from "src/theme/defaultTheme";
import { ThemeProvider } from "styled-components";

export function RuntimeThemeProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const metadataQuery = useMetadataQuery();
  const uiConfigQuery = useUiConfigQuery(metadataQuery.data);
  const uiConfig = uiConfigQuery.data;
  const primaryColor = resolvePrimaryColor(
    uiConfig?.primaryColor,
    window.location.hostname,
    uiConfig?.darkMode ?? false,
  );

  useEffect(() => {
    document.title = uiConfig?.titleTag ? `SCOW - ${uiConfig.titleTag}` : "SCOW";
  }, [uiConfig?.titleTag]);

  useEffect(() => {
    if (!uiConfig?.brandingApiBase) return;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.type = "image/x-icon";
    icon.href = `${uiConfig.brandingApiBase}/icon?type=favicon`;
  }, [uiConfig?.brandingApiBase]);

  useEffect(() => {
    if (!uiConfig) return;

    const enabledLanguages = uiConfig.systemLanguageConfig.enabledLanguages.filter(isSupportedLanguage);
    const currentLanguage = i18n.language;
    if (!isSupportedLanguage(currentLanguage) || !enabledLanguages.includes(currentLanguage)) {
      const nextLanguage = isSupportedLanguage(uiConfig.initialLanguage)
        ? uiConfig.initialLanguage
        : uiConfig.systemLanguageConfig.defaultLanguage;
      void i18n.changeLanguage(isSupportedLanguage(nextLanguage) ? nextLanguage : "en");
    }
  }, [i18n, uiConfig]);

  const antdLocale = getLanguageDefinition(i18n.language).antdLocale;

  return (
    <ConfigProvider locale={antdLocale} theme={{ token: { colorPrimary: primaryColor } }}>
      <AntdApp>
        <ThemeProvider theme={createStyledTheme(primaryColor)}>{children}</ThemeProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
