import { getNotificationNodeClient } from "@scow/lib-notification/build/index";

import { commonConfig } from "./common";

const notifConfig = commonConfig.notification;

export const notifClient = notifConfig?.enabled ? getNotificationNodeClient(notifConfig.address) : undefined;
