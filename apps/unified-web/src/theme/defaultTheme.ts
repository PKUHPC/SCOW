export const DEFAULT_PRIMARY_COLOR = "#1677ff";

export interface PrimaryColorConfig {
  defaultColor?: string;
  darkModeColor?: string;
  hostnameMap?: Record<string, string>;
}

export const resolvePrimaryColor = (
  config: PrimaryColorConfig | undefined,
  hostname: string,
  darkMode: boolean,
) => {
  const hostnameColor = config?.hostnameMap?.[hostname];
  if (hostnameColor) {
    return hostnameColor;
  }

  if (darkMode && config?.darkModeColor) {
    return config.darkModeColor;
  }

  return config?.defaultColor ?? DEFAULT_PRIMARY_COLOR;
};

export const createStyledTheme = (primaryColor: string) => ({
  token: {
    colorPrimary: primaryColor,
    colorBgLayout: "#f5f5f5",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgBlur: "#ffffff",
    colorBorderSecondary: "#f0f0f0",
    boxShadowSecondary: "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12)",
  },
});
