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

import { plugin } from "@ddadaal/tsgrpc-server";
import { UserServiceServer, UserServiceService } from "@scow/scheduler-adapter-protos/build/user";

export const userServiceServer = plugin((server) => {
  server.addService<UserServiceServer>(UserServiceService, {
    addUserToAccount: async () => {
      return [{}];
    },

    removeUserFromAccount: async () => {
      return [{}];
    },

    blockUserInAccount: async () => {
      return [{}];
    },

    unblockUserInAccount: async () => {
      return [{}];
    },

    queryUserInAccountBlockStatus: async () => {
      return [{ blocked: true }];
    },

    deleteUser: async () => {
      return [{}];
    },

  });
});
