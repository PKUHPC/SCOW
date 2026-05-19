import { redirectToAuthLogin } from "@scow/lib-web/build/routes/auth/redirectToLogin";
import { NextApiRequest, NextApiResponse } from "next";
import { publicConfig, runtimeConfig } from "src/utils/config";

export default (req: NextApiRequest, res: NextApiResponse) => {
  redirectToAuthLogin(req, res, runtimeConfig.PROTOCOL, publicConfig.BASE_PATH, runtimeConfig.AUTH_EXTERNAL_URL);
};
