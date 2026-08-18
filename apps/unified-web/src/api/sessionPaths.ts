import type { ScowMetadata } from "src/api/metadata";
import type { ModuleId } from "src/shared/module";

export const getSessionSource = (
  metadata: ScowMetadata,
): Extract<ModuleId, "portal" | "ai" | "mis"> | undefined =>
  (["portal", "ai", "mis"] as const).find((source) => Boolean(metadata.components[source]));

export const getLoginPath = (metadata: ScowMetadata) => {
  const source = getSessionSource(metadata);
  const componentPath = source ? metadata.components[source] : undefined;
  const basePath = !componentPath || componentPath === "/" ? "" : componentPath.replace(/\/$/, "");
  return `${basePath}/api/auth`;
};
