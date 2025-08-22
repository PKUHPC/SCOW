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
import { PrimaryColor } from "@scow/config/build/ui";
import { App, ConfigProvider, theme } from "antd";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import { useContext } from "react";
import { ThemeProvider } from "styled-components";

import { ScowParamsContext } from "../scow-params-provider";

type Props = React.PropsWithChildren<{
  color: string | undefined;
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

export const AntdConfigProvider: React.FC<Props> = ({ children, primaryColor, color }) => {
  const { scowDark, scowLangId } = useContext(ScowParamsContext);

  const { defaultColor, darkModeColor = defaultColor } = primaryColor; // 解构时设置默认值
  let currentPrimaryColor = scowDark ? darkModeColor : defaultColor;
  currentPrimaryColor = currentPrimaryColor ?? color;// isLoading时

  return (
    <ConfigProvider
      locale={ scowLangId === "zh_cn" ? zhCNlocale : enUSlocale}
      theme={{ token: { colorPrimary: currentPrimaryColor, colorInfo: currentPrimaryColor,
        colorText: scowDark ? "#ffffff" : "#434343", fontFamily: "MiSans, sans-serif" },
      algorithm: scowDark ? theme.darkAlgorithm : undefined }}
    >
      <StyledComponentsThemeProvider color={currentPrimaryColor} primaryColor={primaryColor}>
        <App>
          {children}
        </App>
      </StyledComponentsThemeProvider>
    </ConfigProvider>
  );
};
