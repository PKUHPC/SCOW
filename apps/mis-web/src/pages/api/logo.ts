import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { serveLogo } from "@scow/lib-web/build/routes/icon/logo";
import { NextApiRequest, NextApiResponse } from "next/types";
import { runtimeConfig } from "src/utils/config";

const BUILTIN_DEFAULT_DIR = "assets/logo";
const primaryColor = runtimeConfig.UI_CONFIG?.primaryColor?.defaultColor;

export default (req: NextApiRequest, res: NextApiResponse) =>
  serveLogo(req, res, BUILTIN_DEFAULT_DIR, DEFAULT_CONFIG_BASE_PATH, primaryColor);
