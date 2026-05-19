"use client";

import { TransportProvider } from "@connectrpc/connect-query";
import { createConnectTransport } from "@connectrpc/connect-web";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { unstable_noStore as noStore } from "next/cache";
import { join } from "path";
import { useContext, useMemo } from "react";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { getLanguage } from "src/utils/i18n";

const queryClient = new QueryClient();

export const ServerClientProvider = (props: { children: React.ReactNode; basePath: string }) => {
  noStore();

  const { scowLangId } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);
  const commonLang = language.common;

  const { message } = App.useApp();

  const finalTransport = useMemo(() => {
    return createConnectTransport({
      baseUrl: join(props.basePath + "/api"),
      interceptors: [
        (next) => async (req) => {
          try {
            return await next(req);
          } catch (err) {
            // 结构化错误信息解析（适配 ConnectRPC 规范）
            const errorInfo =
              err instanceof Error
                ? {
                    code: "CONNECT_ERROR",
                    message: err.message,
                    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
                  }
                : { code: "UNKNOWN_ERROR" };

            message.error(commonLang.finalError);

            throw errorInfo; // 保持错误冒泡
          }
        },
      ],
    });
  }, [props.basePath]);
  return (
    <TransportProvider transport={finalTransport}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </TransportProvider>
  );
};
