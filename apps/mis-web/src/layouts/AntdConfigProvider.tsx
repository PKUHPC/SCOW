import "dayjs/locale/zh-cn";

import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { PrimaryColor } from "@scow/config/build/ui";
import { AntdConfigProvider as LibAntdConfigProvider } from "@scow/lib-web/build/layouts/AntdConfigProvider";
import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { App, ConfigProvider, theme } from "antd";
import { Locale } from "antd/lib/locale";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import React from "react";
import { useI18n } from "src/i18n";
import { ThemeProvider } from "styled-components";

type Props = React.PropsWithChildren<{
  color: string;
  locale: string;
  primaryColor: PrimaryColor;
}>;

const StyledComponentsThemeProvider: React.FC<Props> = ({ children }) => {
  const { token } = theme.useToken();

  return (
    <ThemeProvider theme={{ token }}>
      {children}
    </ThemeProvider>
  );
};

// FIXME
// The LibAntdConfigProvider only affects themes of the elements from @scow/lib-web package
export const AntdConfigProvider: React.FC<Props> = ({ children, primaryColor, locale }) => {

  const { dark } = useDarkMode();
  const { defaultColor, darkModeColor = defaultColor } = primaryColor; // 解构时设置默认值
  const currentPrimaryColor = dark ? darkModeColor : defaultColor;

  const currentLangId = useI18n().currentLanguage.id;
  const localizedLang = currentLangId ? getAntdLocale(currentLangId) : getAntdLocale(locale);

  return (
    <LibAntdConfigProvider color={currentPrimaryColor} locale={locale}>
      <ConfigProvider
        locale={localizedLang}
        theme={{ token: { colorPrimary: currentPrimaryColor, colorInfo: currentPrimaryColor },
          algorithm: dark ? theme.darkAlgorithm : undefined }}
      >
        <StyledComponentsThemeProvider color={currentPrimaryColor} locale={locale} primaryColor={primaryColor}>
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

