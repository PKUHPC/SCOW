"use client";

import { useSearchParams } from "next/navigation";
import React, { createContext } from "react";

interface ContextProps {
  scowDark: boolean;
  scowLangId: string;
  basePath: string;
}
// 创建一个 Context
export const ScowParamsContext = createContext<ContextProps>({
  scowDark: false,
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
  const scowDark = searchParams?.get("scowDark") === "true";

  return (
    <ScowParamsContext.Provider value={{ scowLangId, scowDark, basePath }}>
      {children}
    </ScowParamsContext.Provider>
  );
};
