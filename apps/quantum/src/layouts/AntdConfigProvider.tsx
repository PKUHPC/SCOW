"use client";

import "dayjs/locale/zh-cn";

import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { PrimaryColor } from "@scow/config/build/ui";
import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { App, ConfigProvider, theme } from "antd";
import { Locale } from "antd/lib/locale";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import React, { } from "react";
import { useI18n } from "src/i18n";
import { FloatButtons } from "src/layouts/FloatButtons";
import { ThemeProvider } from "styled-components";


type Props = React.PropsWithChildren<{
  locale: string | undefined;
  primaryColor: PrimaryColor;
}>;

const StyledComponentsThemeProvider: React.FC<Props & { color: string }> = ({ children }) => {
  const { token } = theme.useToken();

  return (
    <ThemeProvider theme={{ token }}>
      {children}
    </ThemeProvider>
  );
};


export const AntdConfigProvider: React.FC<Props> = ({ children, primaryColor }) => {

  const { dark } = useDarkMode();
  const { defaultColor, darkModeColor = defaultColor } = primaryColor; // 解构时设置默认值
  const currentPrimaryColor = dark ? darkModeColor : defaultColor;

  const currentLangId = useI18n().currentLanguage.id;

  return (
    <ConfigProvider
      locale={getAntdLocale(currentLangId)}
      theme={{ token: { colorPrimary: currentPrimaryColor, colorInfo: currentPrimaryColor,
        colorText: dark ? "#ffffff" : "#434343", fontFamily: "MiSans, sans-serif",
      },
      algorithm: dark ? theme.darkAlgorithm : undefined }}
    >
      <StyledComponentsThemeProvider color={currentPrimaryColor} locale={currentLangId} primaryColor={primaryColor}>
        <App>
          <FloatButtons languageId={currentLangId} />
          {children}
        </App>
      </StyledComponentsThemeProvider>
    </ConfigProvider>
  );
};

function getAntdLocale(langId: string): Locale {
  switch (langId) {
    case SYSTEM_VALID_LANGUAGES.ZH_CN:
      return zhCNlocale;
    case SYSTEM_VALID_LANGUAGES.EN:
    default:
      return enUSlocale;
  }
}
