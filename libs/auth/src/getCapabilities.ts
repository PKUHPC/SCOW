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

import { join } from "path";

export interface Capabilities {
  createUser?: boolean;
  checkPassword?: boolean;
  changePassword?: boolean;
  changeEmail?: boolean;
  getUser?: boolean;
  accountUserRelation?: boolean;
  deleteUser?: boolean;
  lockUser?: boolean;
  updatePasswordResetFlag?: boolean;
}


// Cannot use import type
// type Capabilities = import("../../../apps/auth/src/routes/capabilities").Capabilities;

/**
 * Get auth capabilities
 * @param authUrl the url for auth service
 * @returns auth capabilities
 */
export async function getCapabilities(authUrl: string): Promise<Capabilities> {
  return await (await fetch(join(authUrl, "/capabilities"))).json() as Capabilities;
}
