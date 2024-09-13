/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * OPENSCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const FetchJobsSchema = typeboxRouteSchema({
  method: "POST",

  responses: {
    200: Type.Object({ newJobsCount: Type.Number() }),
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default /* #__PURE__*/route(FetchJobsSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(AdminServiceClient);

    const reply = await asyncClientCall(client, "fetchJobs", {});

    return { 200: { newJobsCount: reply.newJobsCount } };

  });
