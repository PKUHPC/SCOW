import { type ConnectRouter } from "@connectrpc/connect";
import { NoticeTypeService } from "@scow/notification-protos/build/notice_type_pb";
import { checkAuth } from "src/utils/auth/check-auth";
import { enabledNoticeTypes } from "src/utils/message/check-message";

export default (router: ConnectRouter) => {
  router.service(NoticeTypeService, {
    async listNoticeTypes(_, context) {

      await checkAuth(context);

      return {
        noticeTypes: enabledNoticeTypes,
      };
    },
  });
};
