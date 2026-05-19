import { type ConnectRouter } from "@connectrpc/connect";
import { DEFAULT_PRIMARY_COLOR } from "@scow/config/build/ui";
import { ConfigService } from "@scow/notification-protos/build/config_pb";
import { uiConfig } from "src/server/config/ui";
import { checkAuth } from "src/utils/auth/check-auth";

export default (router: ConnectRouter) => {
  router.service(ConfigService, {
    async getUiConfig(_, context) {
      await checkAuth(context);

      return {
        config: uiConfig,
        defaultPrimaryColor: DEFAULT_PRIMARY_COLOR,
      };
    },
  });
};
