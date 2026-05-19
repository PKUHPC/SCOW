"use client";

import React, { useContext } from "react";
import { UiConfig } from "src/server/trpc/route/config";

export const UiConfigContext = React.createContext<{
  hostname: string;
  uiConfig: UiConfig;
}>(undefined!);

export const useUiConfig = () => {
  return useContext(UiConfigContext);
};
