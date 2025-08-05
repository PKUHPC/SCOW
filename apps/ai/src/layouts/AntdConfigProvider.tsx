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

import "dayjs/locale/zh-cn";

import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { PrimaryColor } from "@scow/config/build/ui";
import { App, ConfigProvider, theme } from "antd";
import { Locale } from "antd/lib/locale";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import React, { } from "react";
import { useI18n } from "src/i18n";
import { AppFloatButtons } from "src/layouts/AppFloatButtons";
import { useDarkMode } from "src/layouts/darkMode";
import { ThemeProvider } from "styled-components";


type Props = React.PropsWithChildren<{
  color: string | undefined;
  locale: string | undefined;
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
      components: {
        Menu: {
          itemColor: dark ? "#ffffff" : "#434343",
          itemHoverColor: dark ? "#ffffff" : "#595959",
          subMenuItemBg: dark ? "#211112" : "#ffffff",
        },
      },
      algorithm: dark ? theme.darkAlgorithm : undefined }}
    >
      <StyledComponentsThemeProvider color={currentPrimaryColor} locale={currentLangId} primaryColor={primaryColor}>
        <App>
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
    case SYSTEM_VALID_LANGUAGES.EN:
    default:
      return enUSlocale;
  }
}
