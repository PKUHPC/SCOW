import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { MessageConfigIcon, MyMessageIcon,
  SendMessageIcon, SubscriptionIcon } from "src/assets/icons/menuIcons";
import { PlatformRole, UserInfo } from "src/models/user";

export const userRoutes:
(userInfo: UserInfo | undefined, scowParams: string) => NavItemProps[] = (userInfo, scowParams) => {

  if (!userInfo) return [];

  return [
    {
      Icon: MyMessageIcon,
      text: "消息通知",
      path: "/extensions/notification",
      clickToPath: `/extensions/notification?${scowParams}`,
    },
    {
      Icon: SubscriptionIcon,
      text: "消息订阅",
      path: "/subscription",
      clickToPath: `/subscription?${scowParams}`,
    },
    ...(userInfo.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ? [
      {
        Icon: MessageConfigIcon,
        text: "消息设置",
        path: "/message-config",
        clickToPath: `/message-config?${scowParams}`,
      },
      {
        Icon: SendMessageIcon,
        text: "发送通知",
        path: "/send-message",
        clickToPath: `/send-message?${scowParams}`,
      },
      // {
      //   Icon: CustomMessageIcon,
      //   text: "新建自定义消息类型",
      //   path: "/create-custom-message-type",
      //   clickToPath: `/create-custom-message-type?${scowParams}`,
      // },
    ] : []),
  ];

};
