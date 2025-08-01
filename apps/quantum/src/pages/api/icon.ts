/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { serveIcon } from "@scow/lib-web/build/routes/icon/icon";
import { NextApiRequest, NextApiResponse } from "next";

const BUILTIN_DEFAULT_DIR = "assets/icons";

export default (req: NextApiRequest, res: NextApiResponse) =>
  serveIcon(req, res, BUILTIN_DEFAULT_DIR, DEFAULT_CONFIG_BASE_PATH);
