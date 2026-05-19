"use client";

import React, { useContext } from "react";
import { UiConfig } from "src/server/trpc/route/config";

interface UiCtx {
  hostname: string;
  uiConfig: UiConfig;
}

export const UiConfigContext = React.createContext<UiCtx>({
  hostname: "",
  uiConfig: {} as UiConfig,
});

export const useUiConfig = () => useContext(UiConfigContext);
