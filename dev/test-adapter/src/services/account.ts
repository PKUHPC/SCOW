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
import { AccountServiceServer, AccountServiceService } from "@scow/scheduler-adapter-protos/build/protos/account";

export const accountServiceServer = plugin((server) => {
  server.addService<AccountServiceServer>(AccountServiceService, {
    listAccounts: async () => {
      return [{ accounts: ["a_admin"]}];
    },

    createAccount:async () => {
      return [{}];
    },

    blockAccount: async () => {
      return [{}];
    },

    unblockAccount: async () => {
      return [{}];
    },

    getAllAccountsWithUsers: async () => {
      return [{
        accounts: [
          {
            accountName: "a_user1",
            users: [
              { userId: "user1", userName: "user1", blocked: false },
              { userId: "user3", userName: "user3", blocked: true },
            ],
            owner: "user1",
            blocked: false,
            accountBlockedDetails: [
              { partition: "normal1", blocked: false },
              { partition: "normal2", blocked: true },
            ],
          },
          {
            accountName: "a_user2",
            users: [
              { userId: "user2", userName: "user2", blocked: false },
              { userId: "user3", userName: "user3", blocked: false },
            ],
            owner: "user2",
            blocked: true,
            accountBlockedDetails: [
              { partition: "normal1", blocked: true },
              { partition: "normal2", blocked: true },
            ],
          },
        ],
      }];
    },

    queryAccountBlockStatus: async () => {
      return [{
        blocked: true,
        accountBlockedDetails: [
          { partition: "normal1", blocked: true },
        ],
      }];
    },


  });
});
