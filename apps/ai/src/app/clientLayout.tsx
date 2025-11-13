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

import { legacyLogicalPropertiesTransformer, StyleProvider } from "@ant-design/cssinjs";
import { GlobalStyle } from "@scow/lib-web/build/layouts/globalStyle";
import { usePathname } from "next/navigation";
import { ErrorBoundary } from "src/components/ErrorBoundary";
import { Loading } from "src/components/Loading";
import { TopProgressBar } from "src/components/TopProgressBar";
import { Provider as I18nProvider } from "src/i18n";
import en from "src/i18n/en";
import zh_cn from "src/i18n/zh_cn";
import { AntdConfigProvider } from "src/layouts/AntdConfigProvider";
import { DarkModeCookie, DarkModeProvider } from "src/layouts/darkMode";
import { RootErrorContent } from "src/layouts/error/RootErrorContent";
import { AntdStyleRegistry } from "src/layouts/styleRegistry/AntdRegistry";
import StyledComponentsRegistry from "src/layouts/styleRegistry/StyledComponentsRegistry";
import { UiConfig } from "src/server/trpc/route/config";
import { getAiCurrentLanguageId } from "src/utils/systemLanguage";
import { trpc } from "src/utils/trpc";

import { UiConfigContext } from "./uiContext";

const languagesMap = {
  "zh_cn": zh_cn,
  "en": en,
};

export function ClientLayout(props: {
  children: React.ReactNode,
  initialDark?: DarkModeCookie,
  languageCookie: string | undefined,
  acceptLanguageHeader: string | null,
}) {
  const { children,initialDark,languageCookie,acceptLanguageHeader } = props;
  const pathname = usePathname();

  const useConfigQuery = () => {
    return trpc.config.getUiConfig.useQuery();
  };

  const useConfig = useConfigQuery();

  const uiConfig = useConfig.data || {} as UiConfig;

  const host = (typeof window === "undefined") ? "" : location.host;
  const hostname = host?.includes(":") ? host?.split(":")[0] : host;
  const primaryColor = uiConfig.config?.primaryColor;
  const color = (hostname && primaryColor?.hostnameMap?.[hostname])
    ?? primaryColor?.defaultColor ?? uiConfig.defaultPrimaryColor;

  const darkModeColor = (hostname && primaryColor?.hostnameMap?.[hostname])
  ?? primaryColor?.darkModeColor ?? color;

  const usePublicConfigQuery = () => {
    return trpc.config.publicConfig.useQuery();
  };

  const publicConfig = usePublicConfigQuery();

  if (publicConfig.isLoading) {
    return (
      <body>
        <Loading />
      </body>
    );
  }

  if (publicConfig.isError) {
    return (
      <body>
      </body>
    );
  }

  const initialLanguage =
  getAiCurrentLanguageId(languageCookie,acceptLanguageHeader,publicConfig.data.SYSTEM_LANGUAGE_CONFIG);

  return (
    <StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
      <StyledComponentsRegistry>
        <AntdStyleRegistry>
          {
            useConfig.isLoading || publicConfig.isLoading ?
              <Loading />
              : (
                <DarkModeProvider initial={initialDark}>
                  <I18nProvider initialLanguage={{
                    id: initialLanguage,
                    definitions: languagesMap[initialLanguage as keyof typeof languagesMap],
                  }}
                  >
                    <AntdConfigProvider
                      color={color}
                      locale={initialLanguage}
                      primaryColor={{ defaultColor: color,darkModeColor }}
                    >
                      <GlobalStyle />
                      <TopProgressBar />
                      <ErrorBoundary Component={RootErrorContent} pathname={pathname ?? ""}>
                        <UiConfigContext.Provider
                          value={{
                            hostname,
                            uiConfig,
                          }}
                        >
                          {children}
                        </UiConfigContext.Provider>
                      </ErrorBoundary>
                    </AntdConfigProvider>
                  </I18nProvider>

                </DarkModeProvider>
              )
          }
        </AntdStyleRegistry>
      </StyledComponentsRegistry>
    </StyleProvider>
  );
}
