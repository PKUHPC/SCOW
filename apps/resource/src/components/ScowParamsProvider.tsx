"use client";

import { useSearchParams } from "next/navigation";
import { setCookie } from "nookies";
import React, { createContext, useEffect } from "react";

interface ContextProps {
  scowDark: boolean;
  scowUserToken: string | undefined;
  scowLangId: string;
  basePath: string;
}
// 创建一个 Context
export const ScowParamsContext = createContext<ContextProps>({
  scowDark: false,
  scowUserToken: undefined,
  scowLangId: "zh_cn",
  basePath: "/",
});

interface Props {
  basePath: string;
}

// 定义一个 Provider 组件
export const ScowParamsProvider = ({ children, basePath }: React.PropsWithChildren<Props>) => {
  const searchParams = useSearchParams();
  const scowLangId = searchParams?.get("scowLangId") ?? "zh_cn";
  const scowUserToken = searchParams?.get("scowUserToken") ?? undefined;
  const scowDark = searchParams?.get("scowDark") === "true";

  useEffect(() => {
    if (scowUserToken) {
      // 设置 cookie
      setCookie(null, "SCOW_USER", scowUserToken, {
        maxAge: 24 * 60 * 60, // 设置 cookie 有效期为 1 天
        path: "/", // 全站有效
      });
    }
  }, [scowUserToken]);

  return (
    <ScowParamsContext.Provider value={{ scowLangId, scowUserToken, scowDark, basePath }}>
      {children}
    </ScowParamsContext.Provider>
  );
};
