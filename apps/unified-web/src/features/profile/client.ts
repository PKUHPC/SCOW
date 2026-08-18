import type { ProfileApi } from "src/features/profile/types";

import { USE_MOCK } from "src/config/runtime";

let profileClientPromise: Promise<ProfileApi> | undefined;

export const getProfileClient = () => {
  profileClientPromise ??= USE_MOCK
    ? import("src/features/profile/mockClient").then((module) => module.mockProfileClient)
    : import("src/features/profile/realClient").then((module) => module.realProfileClient);
  return profileClientPromise;
};
