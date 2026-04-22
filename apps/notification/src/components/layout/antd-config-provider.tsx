"use client";
import { generate } from "@ant-design/colors";
import { PrimaryColor } from "@scow/config/build/ui";
import { App, ConfigProvider, theme } from "antd";
import deDElocale from "antd/locale/de_DE";
import enUSlocale from "antd/locale/en_US";
import esESlocale from "antd/locale/es_ES";
import frFRlocale from "antd/locale/fr_FR";
import jaJPlocale from "antd/locale/ja_JP";
import koKRlocale from "antd/locale/ko_KR";
import ptPTlocale from "antd/locale/pt_PT";
import ruRUlocale from "antd/locale/ru_RU";
import zhCNlocale from "antd/locale/zh_CN";
import { useContext, useMemo } from "react";
import { darkGray, lightGray } from "@scow/lib-web/build/styles/constants";
import { ThemeProvider } from "styled-components";

import { ScowParamsContext } from "../scow-params-provider";

type Props = React.PropsWithChildren<{
  color: string | undefined;
  primaryColor: PrimaryColor;
}>;

const StyledComponentsThemeProvider: React.FC<Props> = ({ children, color }) => {
  const { scowDark } = useContext(ScowParamsContext);
  const { token } = theme.useToken();
  const grayPalette = useMemo(() => (scowDark ? darkGray : lightGray), [scowDark]);
  const primaryPalette = useMemo(
    () => generate(color ?? token.colorPrimary),
    [color, token.colorPrimary],
  );
  const styledTheme = useMemo(() => ({
    token,
    palette: {
      primary: primaryPalette,
      gray: grayPalette,
    },
  }), [grayPalette, primaryPalette, token]);

  return (
    <ThemeProvider theme={styledTheme}>
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
      locale={
        ({
          zh_cn: zhCNlocale,
          en: enUSlocale,
          de: deDElocale,
          es: esESlocale,
          fr: frFRlocale,
          ru: ruRUlocale,
          ko: koKRlocale,
          ja: jaJPlocale,
          pt: ptPTlocale,
        } as Record<string, any>)[scowLangId] ?? enUSlocale
      }
      theme={{
        token: {
          colorPrimary: currentPrimaryColor, colorInfo: currentPrimaryColor,
          colorText: scowDark ? "#ffffff" : "#434343", fontFamily: "MiSans, sans-serif"
        },
        algorithm: scowDark ? theme.darkAlgorithm : undefined
      }}
    >
      <StyledComponentsThemeProvider color={currentPrimaryColor} primaryColor={primaryColor}>
        <App>
          {children}
        </App>
      </StyledComponentsThemeProvider>
    </ConfigProvider>
  );
};
