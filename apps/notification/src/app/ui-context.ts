"use client";

import { UiConfigSchema } from "@scow/config/build/ui";
import React, { useContext } from "react";

export const UiConfigContext = React.createContext<{
  hostname: string;
  uiConfig: UiConfigSchema;
}>(undefined!);

export const useUiConfig = () => {
  return useContext(UiConfigContext);
};
