"use client";

import { legacyLogicalPropertiesTransformer, StyleProvider } from "@ant-design/cssinjs";
import { Loading } from "@scow/lib-web/build/layouts/base/Loading";
import { GlobalStyle } from "@scow/lib-web/build/layouts/globalStyle";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ErrorBoundary } from "src/components/ErrorBoundary";
import { TopProgressBar } from "src/components/TopProgressBar";
import { loadLanguageDefinitions, Provider as I18nProvider } from "src/i18n";
import { AntdConfigProvider } from "src/layouts/AntdConfigProvider";
import { DarkModeCookie, DarkModeProvider } from "src/layouts/darkMode";
import { RootErrorContent } from "src/layouts/error/RootErrorContent";
import { ServerErrorPage } from "src/layouts/error/ServerErrorPage";
import { AntdStyleRegistry } from "src/layouts/styleRegistry/AntdRegistry";
import StyledComponentsRegistry from "src/layouts/styleRegistry/StyledComponentsRegistry";
import { UiConfig } from "src/server/trpc/route/config";
import { getAiCurrentLanguageId } from "src/utils/systemLanguage";
import { trpc } from "src/utils/trpc";

import { UiConfigContext } from "./uiContext";

export function ClientLayout(props: {
  children: React.ReactNode;
  initialDark?: DarkModeCookie;
  languageCookie: string | undefined;
  acceptLanguageHeader: string | null;
}) {
  const { children, initialDark, languageCookie, acceptLanguageHeader } = props;
  const pathname = usePathname();

  const useConfigQuery = () => {
    return trpc.config.getUiConfig.useQuery();
  };

  const useConfig = useConfigQuery();

  const uiConfig = useConfig.data || ({} as UiConfig);

  const host = typeof window === "undefined" ? "" : location.host;
  const hostname = host?.includes(":") ? host?.split(":")[0] : host;
  const primaryColor = uiConfig.config?.primaryColor;
  const color =
    (hostname && primaryColor?.hostnameMap?.[hostname]) ?? primaryColor?.defaultColor ?? uiConfig.defaultPrimaryColor;

  const darkModeColor = (hostname && primaryColor?.hostnameMap?.[hostname]) ?? primaryColor?.darkModeColor ?? color;

  const usePublicConfigQuery = () => {
    return trpc.config.publicConfig.useQuery();
  };

  const publicConfig = usePublicConfigQuery();

  const initialLanguageId = publicConfig.data
    ? getAiCurrentLanguageId(languageCookie, acceptLanguageHeader, publicConfig.data.SYSTEM_LANGUAGE_CONFIG)
    : undefined;

  const initialLanguageDefinitionQuery = useQuery({
    enabled: !!initialLanguageId,
    queryKey: ["languageId", initialLanguageId],
    queryFn: () => (initialLanguageId ? loadLanguageDefinitions(initialLanguageId) : undefined),
  });

  if (publicConfig.isLoading || initialLanguageDefinitionQuery.isLoading || !initialLanguageDefinitionQuery.data) {
    return <Loading />;
  }

  if (publicConfig.isError || !publicConfig.isSuccess) {
    return (
      <>
        <ServerErrorPage />
      </>
    );
  }

  if (initialLanguageDefinitionQuery.isError || !initialLanguageDefinitionQuery.isSuccess) {
    return (
      <>
        <ServerErrorPage />
      </>
    );
  }

  return (
    <StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
      <StyledComponentsRegistry>
        <AntdStyleRegistry>
          {useConfig.isLoading || publicConfig.isLoading ? (
            <Loading />
          ) : (
            <DarkModeProvider initial={initialDark}>
              <I18nProvider
                initialLanguage={{
                  id: initialLanguageId!,
                  definitions: initialLanguageDefinitionQuery.data,
                }}
              >
                <AntdConfigProvider
                  color={color}
                  locale={initialLanguageId}
                  primaryColor={{ defaultColor: color, darkModeColor }}
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
          )}
        </AntdStyleRegistry>
      </StyledComponentsRegistry>
    </StyleProvider>
  );
}
