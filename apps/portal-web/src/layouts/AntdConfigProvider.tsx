import "dayjs/locale/zh-cn";

import { generate } from "@ant-design/colors";
import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { PrimaryColor } from "@scow/config/build/ui";
import { AntdConfigProvider as LibAntdConfigProvider } from "@scow/lib-web/build/layouts/AntdConfigProvider";
import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { darkGray,lightGray } from "@scow/lib-web/build/styles/constants";
import { App, ConfigProvider, theme } from "antd";
import { Locale } from "antd/lib/locale";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import React, { useMemo } from "react";
import { useI18n } from "src/i18n";
import { ThemeProvider } from "styled-components";


type Props = React.PropsWithChildren<{
  color: string;
  locale: string;
  primaryColor: PrimaryColor;
}>;

type StyledThemeProviderProps = React.PropsWithChildren<{
  color: string;
  grayPalette: string[];
}>;

const StyledComponentsThemeProvider: React.FC<StyledThemeProviderProps> = ({ children, color, grayPalette }) => {
  const { token } = theme.useToken();

  const primaryPalette = useMemo(
    () => generate(color ?? token.colorPrimary),
    [color, token.colorPrimary],
  );
  const styledTheme = useMemo(() => ({
    token,
    palette: {
      primary: primaryPalette,
      gray: grayPalette,
    },
  }), [grayPalette, primaryPalette, token]);

  return (
    <ThemeProvider theme={styledTheme}>
      {children}
    </ThemeProvider>
  );
};

export const AntdConfigProvider: React.FC<Props> = ({ children, primaryColor, locale }) => {
  const { dark } = useDarkMode();
  const { defaultColor, darkModeColor = defaultColor } = primaryColor; // 解构时设置默认值

  const currentLangId = useI18n().currentLanguage.id;
  const localizedLang = currentLangId ? getAntdLocale(currentLangId) : getAntdLocale(locale);

  const currentPrimaryColor = dark ? darkModeColor : defaultColor;
  const grayPalette = useMemo(() => (dark ? darkGray : lightGray), [dark]);
  return (
    <LibAntdConfigProvider color={currentPrimaryColor} locale={locale}>
      <ConfigProvider
        locale={localizedLang}
        theme={{ token: {
          colorPrimary: currentPrimaryColor,
          colorInfo: currentPrimaryColor,
        }, algorithm: dark ? theme.darkAlgorithm : undefined }}
      >
        <StyledComponentsThemeProvider
          color={currentPrimaryColor}
          grayPalette={grayPalette}
        >
          <App>
            {children}
          </App>
        </StyledComponentsThemeProvider>
      </ConfigProvider>
    </LibAntdConfigProvider>
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
