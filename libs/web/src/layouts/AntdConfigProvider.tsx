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

import "dayjs/locale/zh-cn";

import { legacyLogicalPropertiesTransformer, StyleProvider } from "@ant-design/cssinjs";
import { App, ConfigProvider, theme } from "antd";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import React from "react";
import { useDarkMode } from "src/layouts/darkMode";
import { ThemeProvider } from "styled-components";


type Props = React.PropsWithChildren<{
  color: string;
  locale: string;
}>;

const StyledComponentsThemeProvider: React.FC<Props> = ({ children }) => {
  const { token } = theme.useToken();

  return (
    <ThemeProvider theme={{ token }}>
      {children}
    </ThemeProvider>
  );
};

export const AntdConfigProvider: React.FC<Props> = ({ children, color, locale }) => {

  const { dark } = useDarkMode();

  return (
    <StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
      <ConfigProvider
        locale={locale === "zh_cn" ? zhCNlocale : enUSlocale}
        theme={{ token: { colorPrimary: color, colorInfo: color, fontFamily: "MiSans, sans-serif" },
          components: {
            Menu: {
              itemColor: dark ? "#ffffff" : "#434343",
              itemHoverColor: dark ? "#ffffff" : "#595959",
              subMenuItemBg: dark ? "#211112" : "#ffffff",
            },
          },
          algorithm: dark ? theme.darkAlgorithm : undefined }}
      >
        <StyledComponentsThemeProvider color={color} locale={locale}>
          <App>
            {children}
          </App>
        </StyledComponentsThemeProvider>
      </ConfigProvider>
    </StyleProvider>
  );
};
