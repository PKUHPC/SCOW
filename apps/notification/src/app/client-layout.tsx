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
import "src/styles/globals.css";

import { legacyLogicalPropertiesTransformer, StyleProvider } from "@ant-design/cssinjs";
import { useQuery } from "@connectrpc/connect-query";
import { getUiConfig } from "@scow/notification-protos/build/config-ConfigService_connectquery";
import { Suspense, useEffect, useMemo } from "react";
import { AntdConfigProvider } from "src/components/layout/antd-config-provider";
import { DarkModeProvider } from "src/components/layout/dark-mode-provider";
import { GlobalStyle } from "src/components/layout/global-style";
import { Loading } from "src/components/layout/loading";
import { AntdStyleRegistry } from "src/components/layout/style-registry/antd-registry";
import StyledComponentsRegistry from "src/components/layout/style-registry/styled-components-registry";
import { ScowParamsProvider } from "src/components/scow-params-provider";
import { UiConfigSchema } from "src/models/ui";

import { UiConfigContext } from "./ui-context";

const useReportHeightToScow = () => {

  useEffect(() => {
    // postIframeMessage();
    const sendMessage = (height: number) => {
      window.parent?.postMessage({
        type: "scow.extensionPageHeightChanged", // 发送信息的类型，不允许更改
        payload: {
          height: height,
        },
      }, "*");
    };

    const observer = new ResizeObserver((entries) => {

      const e = entries[0];
      sendMessage(e.contentRect.height);
    });


    const htmlElement = document.querySelector("html")!;

    sendMessage(htmlElement.getBoundingClientRect().height + 20);

    observer.observe(htmlElement);

    return () => {
      observer.disconnect();
    };

  }, []);
};

export function ClientLayout(props: {
  children: React.ReactNode,
  basePath: string,
}) {
  useReportHeightToScow();

  const { data, isLoading } = useQuery(getUiConfig);


  const uiConfig = data?.config || {} as UiConfigSchema;

  const host = (typeof window === "undefined") ? "" : location.host;
  const hostname = host?.includes(":") ? host?.split(":")[0] : host;
  const primaryColor = uiConfig?.primaryColor;
  const color = useMemo(() => {
    return (hostname && primaryColor?.hostnameMap?.[hostname])
    ?? primaryColor?.defaultColor ?? data?.defaultPrimaryColor ?? "#94070A";
  }, [data]);

  const darkModeColor = useMemo(() => {
    return (hostname && primaryColor?.hostnameMap?.[hostname])
    ?? primaryColor?.darkModeColor ?? color;
  }, [data]);

  return (
    <Suspense>
      <ScowParamsProvider basePath={props.basePath}>
        <StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
          <StyledComponentsRegistry>
            <AntdStyleRegistry>
              <body>
                {
                  isLoading ? (
                    <AntdConfigProvider color={color} primaryColor={{ defaultColor: color,darkModeColor }}>
                      <Loading />
                    </AntdConfigProvider>
                  ) : (
                    <DarkModeProvider>
                      <AntdConfigProvider color={color} primaryColor={{ defaultColor: color,darkModeColor }}>
                        <GlobalStyle />
                        <UiConfigContext.Provider
                          value={{
                            hostname,
                            uiConfig,
                          }}
                        >

                          {props.children}

                        </UiConfigContext.Provider>
                      </AntdConfigProvider>
                    </DarkModeProvider>
                  )
                }

              </body>
            </AntdStyleRegistry>
          </StyledComponentsRegistry>
        </StyleProvider>
      </ScowParamsProvider>
    </Suspense>

  );
}
