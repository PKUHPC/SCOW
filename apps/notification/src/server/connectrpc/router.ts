import { ConnectRouter } from "@connectrpc/connect";
import adminMessageConfigRouter from "src/server/connectrpc/route/admin-message-config";
import apiKeyRouter from "src/server/connectrpc/route/api-key";
import configRouter from "src/server/connectrpc/route/config";
import messageRouter from "src/server/connectrpc/route/message";
import messageTypeRouter from "src/server/connectrpc/route/message-type";
import noticeTypeRouter from "src/server/connectrpc/route/notice-type";
import scowMessageRouter from "src/server/connectrpc/route/scow-message";
import UserRouter from "src/server/connectrpc/route/user";
import userSubscriptionRouter from "src/server/connectrpc/route/user-subscription";

export default (router: ConnectRouter) => {
  apiKeyRouter(router);
  adminMessageConfigRouter(router);
  userSubscriptionRouter(router);
  messageTypeRouter(router);
  messageRouter(router);
  noticeTypeRouter(router);
  configRouter(router);
  UserRouter(router);
  scowMessageRouter(router);
};
