import { NextApiRequest, NextApiResponse } from "next";

import { applyMiddleware } from "../../server/middleware/cors";

function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    res.status(200).json({
      portal: {
        navbarLinks: {
          enabled: true,
          // "autoRefresh": {
          //   "enabled": true,
          //   "intervalMs": 60000,
          // },
        },
        rewriteNavigations: true,
      },
      mis: {
        navbarLinks: {
          enabled: true,
          // "autoRefresh": {
          //   "enabled": true,
          //   "intervalMs": 60000,
          // },
        },
        rewriteNavigations: true,
      },
      ai: {
        navbarLinks: {
          enabled: true,
        },
        rewriteNavigations: true,
      },
    });
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default applyMiddleware(handler);
