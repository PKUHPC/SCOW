import { USE_MOCK } from "src/config/runtime";
import type { DashboardApi } from "src/features/dashboard/types";

let dashboardClientPromise: Promise<DashboardApi> | undefined;

export const getDashboardClient = () => {
  dashboardClientPromise ??= USE_MOCK
    ? import("src/features/dashboard/mockClient").then((module) => module.mockDashboardClient)
    : import("src/features/dashboard/realClient").then((module) => module.realDashboardClient);
  return dashboardClientPromise;
};
