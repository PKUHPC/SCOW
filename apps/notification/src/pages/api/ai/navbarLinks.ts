import { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import { applyMiddleware } from "src/server/middleware/cors";
import { hasUnreadMessage } from "src/utils/message/has-unread-message";
import { BASE_PATH } from "src/utils/processEnv";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
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

    const svgFilePath =
      cookie && scowUserCookie && (await hasUnreadMessage(scowUserCookie))
        ? path.join(BASE_PATH, "icons", "dot-ding.svg")
        : path.join(BASE_PATH, "icons", "ding.svg");

    const navbarLinks = [
      {
        path: "/notification",
        text: "",
        icon: { src: svgFilePath },
      },
    ];

    res.status(200).json({ navbarLinks });
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default applyMiddleware(handler);
