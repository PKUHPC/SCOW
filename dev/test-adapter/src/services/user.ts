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
