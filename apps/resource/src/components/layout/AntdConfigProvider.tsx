"use client";
import { PrimaryColor } from "@scow/config/build/ui";
import { App, ConfigProvider, theme } from "antd";
import enUSlocale from "antd/locale/en_US";
import zhCNlocale from "antd/locale/zh_CN";
import { useContext } from "react";
import { ScowParamsContext } from "src/components/ScowParamsProvider";
import { ThemeProvider } from "styled-components";

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
  currentPrimaryColor = currentPrimaryColor ?? color;// useConfig.isLoading时

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
