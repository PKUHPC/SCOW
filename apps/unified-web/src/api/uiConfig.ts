import type { ScowMetadata } from "src/api/metadata";
import type { PrimaryColorConfig } from "src/theme/defaultTheme";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getDomainApiBase } from "src/api/http";
import { USE_MOCK } from "src/config/runtime";
import { mockUiConfig } from "src/mocks/uiConfig";

interface MisInitialConfig {
  userInfo?: { token: string };
  primaryColor: {
    defaultColor: string;
    darkModeColor?: string;
  };
  darkModeCookieValue?: {
    dark: boolean;
    mode: "system" | "dark" | "light";
  };
  titleTag?: string;
  initialLanguageId: string;
  systemLanguageConfig: SystemLanguageConfig;
}

export interface SystemLanguageConfig {
  defaultLanguage: string;
  isUsingI18n: boolean;
  autoDetectWhenUserNotSet: boolean;
  enabledLanguages: string[];
}

export interface UnifiedUiConfig {
  userToken?: string;
  primaryColor: PrimaryColorConfig;
  darkMode: boolean;
  brandingApiBase?: string;
  titleTag?: string;
  initialLanguage: string;
  systemLanguageConfig: SystemLanguageConfig;
}

async function getUiConfig(): Promise<UnifiedUiConfig> {
  const response = await axios.get<MisInitialConfig>(`${getDomainApiBase("mis")}/getAppInitialConfig`, {
    withCredentials: true,
  });
  return {
    userToken: response.data.userInfo?.token,
    primaryColor: response.data.primaryColor,
    darkMode: response.data.darkModeCookieValue?.dark ?? false,
    brandingApiBase: getDomainApiBase("mis"),
    titleTag: response.data.titleTag,
    initialLanguage: response.data.initialLanguageId,
    systemLanguageConfig: response.data.systemLanguageConfig,
  };
}

export const useUiConfigQuery = (metadata: ScowMetadata | undefined) =>
  useQuery({
    queryKey: ["app", "uiConfig", metadata?.components],
    queryFn: async () => (USE_MOCK ? mockUiConfig : getUiConfig()),
    enabled: USE_MOCK || metadata !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
