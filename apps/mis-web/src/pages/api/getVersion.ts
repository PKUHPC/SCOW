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

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetVersionSchema = typeboxRouteSchema({

  method: "GET",

  responses: {
    200: Type.Object({
      major: Type.Number(),
      minor: Type.Number(),
      patch: Type.Number(),
    }),

  },
});

export default route(GetVersionSchema,
  async () => {
    const client = getClient(ConfigServiceClient);
    const reply = await asyncClientCall(client, "getVersion", { });
    return { 200: reply };
  });
