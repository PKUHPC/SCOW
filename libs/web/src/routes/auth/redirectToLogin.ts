import { joinWithUrl } from "@scow/utils";
import { NextApiRequest, NextApiResponse } from "next";
import { join } from "path";

export const redirectToAuthLogin = (
  req: NextApiRequest,
  res: NextApiResponse,
  protocol: string,
  basePath: string,
  authExternalUrl: string,
) => {
  const url = new URL(req.url!, `${protocol}://${req.headers.host}`);

  const callbackUrl = url.origin + join(basePath, "/api/auth/callback");

  const target = joinWithUrl(authExternalUrl, `public/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  res.redirect(target);
};
