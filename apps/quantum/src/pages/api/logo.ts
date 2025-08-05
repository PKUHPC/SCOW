import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { serveLogo } from "@scow/lib-web/build/routes/icon/logo";
import { NextApiRequest, NextApiResponse } from "next/types";

const BUILTIN_DEFAULT_DIR = "assets/logo";

export default (req: NextApiRequest, res: NextApiResponse) =>
  serveLogo(req, res, BUILTIN_DEFAULT_DIR, DEFAULT_CONFIG_BASE_PATH);
