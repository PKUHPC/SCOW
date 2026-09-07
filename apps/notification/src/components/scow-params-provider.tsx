"use client";

import { useSearchParams } from "next/navigation";
import React, { createContext, PropsWithChildren } from "react";

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
export const ScowParamsProvider: React.FC<PropsWithChildren<Props>> = ({ children, basePath }) => {
  const searchParams = useSearchParams();
  const rawLang = searchParams?.get("scowLangId") ?? "zh_cn";
  const norm = (rawLang || "zh_cn").toLowerCase().replace(/-/g, "_");
  const base = norm.startsWith("zh") ? "zh_cn" : norm.split("_")[0];
  const supported = new Set(["zh_cn", "en", "pt", "es", "ru", "ko", "ja", "de", "fr"]);
  const scowLangId = supported.has(base) ? base : "zh_cn";
  const scowDark = searchParams?.get("scowDark") === "true";

  return (
    <ScowParamsContext.Provider value={{ scowLangId, scowDark, basePath }}>
      {children}
    </ScowParamsContext.Provider>
  );
};
