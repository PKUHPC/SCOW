import type { ScowMetadata } from "src/api/metadata";

export const mockMetadata: ScowMetadata = {
  basePath: "/",
  version: "dev",
  components: {
    portal: "/portal",
    mis: "/mis",
    ai: "/ai",
    quantum: "/quantum",
    notification: "/notification",
  },
};
