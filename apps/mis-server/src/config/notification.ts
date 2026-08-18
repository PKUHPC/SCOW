import { getNotificationNodeClient } from "@scow/lib-notification/build/index";

import { commonConfig } from "./common";

export const notifClient = getNotificationNodeClient(commonConfig.notification.address);
