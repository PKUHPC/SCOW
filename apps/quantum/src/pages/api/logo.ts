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
import { serveLogo } from "@scow/lib-web/build/routes/icon/logo";
import { NextApiRequest, NextApiResponse } from "next/types";

const BUILTIN_DEFAULT_DIR = "assets/logo";

export default (req: NextApiRequest, res: NextApiResponse) =>
  serveLogo(req, res, BUILTIN_DEFAULT_DIR, DEFAULT_CONFIG_BASE_PATH);
