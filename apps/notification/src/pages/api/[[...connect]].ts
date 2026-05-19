import type { NextApiRequest, NextApiResponse } from "next";

import { nextJsApiRouter } from "@connectrpc/connect-next";
import { loggerInterceptor } from "src/server/connectrpc/interceptor/loggerInterceptor";
import routes from "src/server/connectrpc/router";

const { handler, config: conf } = nextJsApiRouter({ routes, interceptors: [loggerInterceptor] });

const customHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  // 设置 CORS 头信息
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*"); // 根据需要更改为具体的域名
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Authorization",
  );

  // 处理预检请求
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // 调用 Connect RPC 的 handler 来处理实际的请求
  await handler(req, res);
};

const config = conf as any;

export { config, customHandler as default };
