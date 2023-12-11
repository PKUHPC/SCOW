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

import { App, ConfigProvider, theme } from "antd";
import zhCNlocale from "antd/locale/zh_CN";
import React, { } from "react";
import { AppFloatButtons } from "src/layouts/AppFloatButtons";
import { PRIMARY_COLOR } from "src/layouts/constants";
import { useDarkMode } from "src/layouts/darkMode";
import { ThemeProvider } from "styled-components";


type Props = React.PropsWithChildren<{
  // color: string;
}>;

const StyledComponentsThemeProvider: React.FC<Props> = ({ children }) => {
  const { token } = theme.useToken();

  return (
    <ThemeProvider theme={{ token }}>
      {children}
    </ThemeProvider>
  );
};

export const AntdConfigProvider: React.FC<Props> = ({ children }) => {

  const { dark } = useDarkMode();

  return (
    <ConfigProvider
      locale={zhCNlocale}
      theme={{ token: { colorPrimary: PRIMARY_COLOR, colorInfo: PRIMARY_COLOR },
        algorithm: dark ? theme.darkAlgorithm : undefined }}
    >
      <StyledComponentsThemeProvider>
        <App>
          <AppFloatButtons />
          {children}
        </App>
      </StyledComponentsThemeProvider>
    </ConfigProvider>
  );
};
