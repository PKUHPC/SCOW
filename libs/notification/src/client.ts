import { GenService, GenServiceMethods } from "@bufbuild/protobuf/codegenv2";
import { Client, createClient, Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { getCommonConfig } from "@scow/config/build/common";
import { MessageBridgeService } from "@scow/notification-protos/build/message_bridge_pb";
import { MessageConfigService } from "@scow/notification-protos/build/message_config_pb";
import { MessageService } from "@scow/notification-protos/build/message_pb";
import { MessageTypeService } from "@scow/notification-protos/build/message_type_pb";
import { ScowMessageService } from "@scow/notification-protos/build/scow_message_pb";
import { UserSubscriptionService } from "@scow/notification-protos/build/user_subscription_pb";
import { join } from "path";

const setAuthorization: Interceptor = (next) => async (req) => {
  const commonConfig = getCommonConfig();
  const token = commonConfig.scowApi?.auth?.token;

  if (token) {
    req.header.set("authorization", `Bearer ${token}`);
  }
  return next(req);
};

export interface NotificationClient {
  scowMessage: Client<typeof ScowMessageService>;
  message: Client<typeof MessageService>;
  messageConfig: Client<typeof MessageConfigService>;
  messageType: Client<typeof MessageTypeService>;
  userSubscription: Client<typeof UserSubscriptionService>;
  messageBridge: Client<typeof MessageBridgeService>;
}

export function getClient<TService extends GenServiceMethods>(
  notificationUrl: string,
  service: GenService<TService>,
): Client<GenService<TService>> {
  const transport = createConnectTransport({
    baseUrl: join(notificationUrl, "api"),
    httpVersion: "1.1",
    interceptors: [setAuthorization],
  });
  return createClient(service, transport);
}

export const getNotificationNodeClient = (notificationUrl: string) => {
  return {
    scowMessage: getClient(notificationUrl, ScowMessageService),
    message: getClient(notificationUrl, MessageService),
    messageConfig: getClient(notificationUrl, MessageConfigService),
    messageType: getClient(notificationUrl, MessageTypeService),
    userSubscription: getClient(notificationUrl, UserSubscriptionService),
    messageBridge: getClient(notificationUrl, MessageBridgeService),
  } as NotificationClient;
};
