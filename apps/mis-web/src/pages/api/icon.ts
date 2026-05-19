import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { serveIcon } from "@scow/lib-web/build/routes/icon/icon";
import { NextApiRequest, NextApiResponse } from "next";

const BUILTIN_DEFAULT_DIR = "assets/icons";

export default (req: NextApiRequest, res: NextApiResponse) =>
  serveIcon(req, res, BUILTIN_DEFAULT_DIR, DEFAULT_CONFIG_BASE_PATH);
