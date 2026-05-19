import { type ConnectRouter } from "@connectrpc/connect";
import { UserService } from "@scow/notification-protos/build/user_pb";
import { checkAuth } from "src/utils/auth/check-auth";

export default (router: ConnectRouter) => {
  router.service(UserService, {
    async getUserInfo(_, context) {
      const user = await checkAuth(context);

      return {
        userInfo: user,
      };
    },
  });
};
