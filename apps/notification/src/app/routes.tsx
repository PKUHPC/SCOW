import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { MessageConfigIcon, MyMessageIcon, SendMessageIcon, SubscriptionIcon } from "src/assets/icons/menuIcons";
import { PlatformRole, UserInfo } from "src/models/user";
import { getLanguage } from "src/utils/i18n";

export const userRoutes: (userInfo: UserInfo | undefined, scowParams: string, scowLangId?: string) => NavItemProps[] = (
  userInfo,
  scowParams,
  scowLangId,
) => {
  if (!userInfo) return [];

  const language = getLanguage(scowLangId).api;

  return [
    {
      Icon: MyMessageIcon,
      text: language.myMsgs,
      path: "/extensions/notification",
      clickToPath: `/extensions/notification?${scowParams}`,
    },
    {
      Icon: SubscriptionIcon,
      text: language.msgSub,
      path: "/subscription",
      clickToPath: `/subscription?${scowParams}`,
    },
    ...(userInfo.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
      ? [
          {
            Icon: MessageConfigIcon,
            text: language.msgConfig,
            path: "/message-config",
            clickToPath: `/message-config?${scowParams}`,
          },
          {
            Icon: SendMessageIcon,
            text: language.sendMsg,
            path: "/send-message",
            clickToPath: `/send-message?${scowParams}`,
          },
          // {
          //   Icon: CustomMessageIcon,
          //   text: language.createType,
          //   path: "/create-custom-message-type",
          //   clickToPath: `/create-custom-message-type?${scowParams}`,
          // },
        ]
      : []),
  ];
};
