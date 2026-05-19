import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const applyMiddleware = (handler: NextApiHandler) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "OPTIONS") {
      if (res instanceof NextResponse) {
        return NextResponse.json({}, { headers: corsHeaders });
      } else {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
      }
    }
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return handler(req, res);
  };
};
