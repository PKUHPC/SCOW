import { NextApiRequest, NextApiResponse } from "next";
import { PlatformRole } from "src/models/user";
import { validateToken } from "src/server/auth/token";
import { applyMiddleware } from "src/server/middleware/cors";
import { getLanguage } from "src/utils/i18n";

interface NavItem {
  path: string;
  text: string;
  clickToPath?: string | undefined;
  clickable?: boolean | undefined;
  icon?: {
    src: string;
    alt?: string;
  };
  svgIcon?: string; // 使用被插入系统的svg icon，icon可以随菜单变色
  openInNewPage?: boolean | undefined;
  children?: NavItem[] | undefined;
  hideIfNotActive?: boolean | undefined;
}

interface Request {
  navs: NavItem[];
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body as Request;

  const searchParams = req.query;
  const scowLangId = searchParams.scowLangId ?? "zh_cn";
  const language = getLanguage(scowLangId as string).api;

  const cookie = req.headers.cookie;
  // 将 cookie 字符串解析为对象
  const cookies = cookie?.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  // 获取名为 'SCOW_USER' 的 cookie
  // eslint-disable-next-line @typescript-eslint/dot-notation
  const scowUserCookie = cookies?.["SCOW_USER"];

  const userInfo = await validateToken(scowUserCookie);

  if (!userInfo) {
    return res.status(401).json({ message: "UNAUTHORIZED" });
  }

  body.navs.push({
    path: "/",
    clickToPath: "/notification",
    text: language.notification,
    hideIfNotActive: true,
    children: [
      {
        path: "/notification",
        clickToPath: undefined,
        text: language.myMsgs,
        svgIcon: "NotificationIcon",
      },
      {
        path: "/subscription",
        clickToPath: undefined,
        text: language.msgSub,
        svgIcon: "SubscriptionIcon",
      },
    ],
  });

  if (userInfo?.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
    // 将管理员通知页导航插入到 平台管理-通知设置下
    const adminTargetNav = body.navs
      .find((nav) => nav.path === "/admin")
      ?.children?.find((child) => child.path === "/admin/notification");

    if (!adminTargetNav?.children) {
      return res.status(400).json({
        message:
          "The navigation Platform/Notification can not be found." +
          " Please confirm your navigation path name and try again.",
      });
    }

    adminTargetNav.children?.push(
      {
        path: "/message-config",
        clickToPath: undefined,
        text: language.msgConfig,
        svgIcon: "MessageConfigIcon",
      },
      {
        path: "/send-message",
        clickToPath: undefined,
        text: language.sendMsg,
        svgIcon: "SendMessageIcon",
      },
      {
        path: "/create-custom-message-type",
        clickToPath: undefined,
        text: language.createType,
        svgIcon: "CreateCustomMessageIcon",
      },
    );
  }

  return res.status(200).json({ navs: body.navs });
}

export default applyMiddleware(handler);
