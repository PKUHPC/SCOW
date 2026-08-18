import { USE_MOCK } from "src/config/runtime";
import type { NotificationApi } from "src/features/notification/types";

let notificationClientPromise: Promise<NotificationApi> | undefined;

export const getNotificationClient = () => {
  notificationClientPromise ??= (
    USE_MOCK
      ? import("src/features/notification/mockClient").then((module) => module.mockNotificationClient)
      : import("src/features/notification/realClient").then((module) => module.realNotificationClient)
  ).catch((error: unknown) => {
    notificationClientPromise = undefined;
    throw error;
  });
  return notificationClientPromise;
};
