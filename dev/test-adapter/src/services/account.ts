import { plugin } from "@ddadaal/tsgrpc-server";
import { AccountServiceServer, AccountServiceService } from "@scow/scheduler-adapter-protos/build/account";

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
          },
          {
            accountName: "a_user2",
            users: [
              { userId: "user2", userName: "user2", blocked: false },
              { userId: "user3", userName: "user3", blocked: false },
            ],
            owner: "user2",
            blocked: true,
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

    deleteAccount: async () => {
      return [{}];
    },

    blockAccountWithPartitions: async () => {
      return [{}];
    },

    unblockAccountWithPartitions: async () => {
      return [{}];
    },

    queryAccountBlockStatusWithPartitions: async () => {
      return [{
        blocked: true,
        accountBlockedDetails: [
          { partition: "normal1", blocked: true },
        ],
      }];
    },

    getAllAccountsWithUsersAndBlockedDetails: async () => {
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

    syncAccountUserInfo: async () => {
      return [{
        completelyExecuted: true,
        syncResults: [
          {
            syncOperation: {
              $case:"removeUserFromAccount",
              removeUserFromAccount: {
                accountName: "hpcB",
                userId:"a",
              },
            },
            success: false,
            failedMessage: "remove user a from account hpcB, get user uid failed: user: unknown user a",
          },
          {
            syncOperation: {
              $case:"createAccount",
              createAccount: {
                accountName: "hpcNew",
              },
            },
            success: true,
          },
          {
            syncOperation: {
              $case:"blockAccount",
              blockAccount: {
                accountName: "hpcNew",
              },
            },
            success: true,
          },
          {
            syncOperation: {
              $case:"addUserToAccount",
              addUserToAccount: {
                accountName: "hpcNew",
                userId: "new",
              },
            },
            success: true,
          },
          {
            syncOperation: {
              $case:"blockUserInAccount",
              blockUserInAccount: {
                accountName: "hpcNew",
                userId: "new",
              },
            },
            success: false,
            failureMessage: "block user new in account hpcNew, error occurred.",
          },


        ]}];
    },


  });
});
