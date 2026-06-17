"use client";

import "dayjs/locale/zh-cn";
import { generate } from "@ant-design/colors";
import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { PrimaryColor } from "@scow/config/build/ui";
import { darkGray, lightGray } from "@scow/lib-web/build/styles/constants";
import { App, ConfigProvider, theme } from "antd";
import { Locale } from "antd/lib/locale";
import deDElocale from "antd/locale/de_DE";
import enUSlocale from "antd/locale/en_US";
import esESlocale from "antd/locale/es_ES";
import frFRlocale from "antd/locale/fr_FR";
import jaJPlocale from "antd/locale/ja_JP";
import koKRlocale from "antd/locale/ko_KR";
import ptPTlocale from "antd/locale/pt_PT";
import ruRUlocale from "antd/locale/ru_RU";
import zhCNlocale from "antd/locale/zh_CN";
import React, { useMemo } from "react";
import { SchedulerAdapterTimeoutErrorHandler } from "src/app/trpcClient";
import { useI18n } from "src/i18n";
import { AppFloatButtons } from "src/layouts/AppFloatButtons";
import { useDarkMode } from "src/layouts/darkMode";
import { ThemeProvider } from "styled-components";

type Props = React.PropsWithChildren<{
  color: string | undefined;
  locale: string | undefined;
  primaryColor: PrimaryColor;
}>;

type StyledThemeProviderProps = React.PropsWithChildren<{
  color: string | undefined;
  grayPalette: string[];
}>;

const StyledComponentsThemeProvider: React.FC<StyledThemeProviderProps> = ({ children, color, grayPalette }) => {
  const { token } = theme.useToken();

  const primaryPalette = useMemo(() => generate(color ?? token.colorPrimary), [color, token.colorPrimary]);
  const styledTheme = useMemo(
    () => ({
      token,
      palette: {
        primary: primaryPalette,
        gray: grayPalette,
      },
    }),
    [grayPalette, primaryPalette, token],
  );
  return <ThemeProvider theme={styledTheme}>{children}</ThemeProvider>;
};

export const AntdConfigProvider: React.FC<Props> = ({ children, primaryColor }) => {
  const { dark } = useDarkMode();
  const { defaultColor, darkModeColor = defaultColor } = primaryColor; // 解构时设置默认值
  const currentPrimaryColor = dark ? darkModeColor : defaultColor;
  const grayPalette = useMemo(() => (dark ? darkGray : lightGray), [dark]);

  const currentLangId = useI18n().currentLanguage.id;

  return (
    <ConfigProvider
      locale={getAntdLocale(currentLangId)}
      theme={{
        token: {
          colorPrimary: currentPrimaryColor,
          colorInfo: currentPrimaryColor,
          colorText: dark ? "#ffffff" : "#434343",
          fontFamily: "MiSans, sans-serif",
        },
        components: {
          Menu: {
            itemColor: dark ? "#ffffff" : "#434343",
            itemHoverColor: dark ? "#ffffff" : "#595959",
            subMenuItemBg: dark ? "#211112" : "#ffffff",
          },
        },
        algorithm: dark ? theme.darkAlgorithm : undefined,
      }}
    >
      <StyledComponentsThemeProvider color={currentPrimaryColor} grayPalette={grayPalette}>
        <App>
          <SchedulerAdapterTimeoutErrorHandler />
          <AppFloatButtons />
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
    case SYSTEM_VALID_LANGUAGES.JA:
      return jaJPlocale;
    case SYSTEM_VALID_LANGUAGES.KO:
      return koKRlocale;
    case SYSTEM_VALID_LANGUAGES.FR:
      return frFRlocale;
    case SYSTEM_VALID_LANGUAGES.DE:
      return deDElocale;
    case SYSTEM_VALID_LANGUAGES.ES:
      return esESlocale;
    case SYSTEM_VALID_LANGUAGES.PT:
      return ptPTlocale;
    case SYSTEM_VALID_LANGUAGES.RU:
      return ruRUlocale;
    case SYSTEM_VALID_LANGUAGES.EN:
    default:
      return enUSlocale;
  }
}
