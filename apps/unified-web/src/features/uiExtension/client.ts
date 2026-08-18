import type { UiExtensionApi } from "src/features/uiExtension/types";

import { USE_MOCK } from "src/config/runtime";

let clientPromise: Promise<UiExtensionApi> | undefined;

export const getUiExtensionClient = () => {
  clientPromise ??= USE_MOCK
    ? import("src/features/uiExtension/mockClient").then((module) => module.mockUiExtensionClient)
    : import("src/features/uiExtension/realClient").then((module) => module.realUiExtensionClient);
  return clientPromise;
};
