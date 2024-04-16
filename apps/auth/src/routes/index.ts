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

import { getCapabilitiesRoute } from "src/routes/capabilities";
import { changeEmailRoute } from "src/routes/changeEmail";
import { changePasswordRoute } from "src/routes/changePassword";
import { checkPasswordRoute } from "src/routes/checkPassword";
import { createUserRoute } from "src/routes/createUser";
import { getUserRoute } from "src/routes/getUser";
import { logoutRoute } from "src/routes/logout";

import { authRoute } from "./auth";
import { authCallbackRoute } from "./callback";
import { getPhoneRoute } from "./getPhone";
import { loginRoute } from "./login";
import { registerUserRoute } from "./register";
import { sendMessagesCodeRoute } from "./sendMessagesCode";
import { UnicomCallbackRoute } from "./unicomCallback";
import { validateTokenRoute } from "./validateToken";

export const routes = [
  authRoute,
  authCallbackRoute,
  validateTokenRoute,
  createUserRoute,
  changePasswordRoute,
  logoutRoute,
  getCapabilitiesRoute,
  getUserRoute,
  changeEmailRoute,
  checkPasswordRoute,
  UnicomCallbackRoute,
  sendMessagesCodeRoute,
  registerUserRoute,
  loginRoute,
  getPhoneRoute,
];
