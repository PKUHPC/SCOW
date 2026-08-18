import type { ReactNode } from "react";

export type ModuleId = "portal" | "mis" | "ai" | "notification" | "quantum";
export type Translate = (key: string, defaultValue: string) => string;

export interface ModuleRouteDefinition {
  path: string;
  title: (translate: Translate) => string;
}

export interface ModuleDefinition {
  id: ModuleId;
  path: `/${ModuleId}`;
  title: (translate: Translate) => string;
  icon: ReactNode;
  children: ModuleRouteDefinition[];
}
