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

import { GlobalStyle } from "@scow/lib-web/build/layouts/globalStyle";
import { usePathname } from "next/navigation";
import { ErrorBoundary } from "src/components/ErrorBoundary";
import { TopProgressBar } from "src/components/TopProgressBar";
import { AntdConfigProvider } from "src/layouts/AntdConfigProvider";
import { DarkModeCookie, DarkModeProvider } from "src/layouts/darkMode";
import { RootErrorContent } from "src/layouts/error/RootErrorContent";
import { AntdStyleRegistry } from "src/layouts/styleRegistry/AntdRegistry.jsx";
import StyledComponentsRegistry from "src/layouts/styleRegistry/StyledComponentsRegistry.jsx";

export function ClientLayout(props: {
  children: React.ReactNode,
  initialDark?: DarkModeCookie,
  color: string,
}) {
  const pathname = usePathname();

  return (

    <StyledComponentsRegistry>
      <AntdStyleRegistry>
        <body>
          <DarkModeProvider initial={props.initialDark}>
            <AntdConfigProvider color={props.color}>
              <GlobalStyle />
              <TopProgressBar />
              <ErrorBoundary Component={RootErrorContent} pathname={pathname ?? ""}>
                {props.children}
              </ErrorBoundary>
            </AntdConfigProvider>
          </DarkModeProvider>
        </body>
      </AntdStyleRegistry>
    </StyledComponentsRegistry>
  );
}
